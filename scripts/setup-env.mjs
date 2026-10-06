import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const examplePath = join(root, ".env.example");
const envPath = join(root, ".env");
const webEnvPath = join(root, "apps", "web", ".env.local");

function randomSecret(bytes) {
  return randomBytes(bytes).toString("base64url");
}

function readValue(text, key) {
  return text.match(new RegExp(`^\\s*${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

function replaceOrAppend(text, key, value) {
  const pattern = new RegExp(`^\\s*${key}=.*$`, "m");
  const line = `${key}=${value}`;
  return pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\\n${line}\\n`;
}

if (!existsSync(envPath)) {
  await copyFile(examplePath, envPath);
  console.log("Created root .env from .env.example.");
}

let env = await readFile(envPath, "utf8");
const authSecret = readValue(env, "AUTH_SECRET");
const workerSecret = readValue(env, "EVALUATION_WORKER_SECRET");

if (!authSecret || authSecret.length < 32 || /^replace-with-/i.test(authSecret)) {
  env = replaceOrAppend(env, "AUTH_SECRET", randomSecret(48));
}
if (!workerSecret || workerSecret.length < 32 || /^replace-with-/i.test(workerSecret)) {
  env = replaceOrAppend(env, "EVALUATION_WORKER_SECRET", randomSecret(64));
}

const databaseUrl = readValue(env, "DATABASE_URL");
if (!databaseUrl) {
  env = replaceOrAppend(env, "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/interview_platform");
}

await writeFile(envPath, env, "utf8");
await mkdir(join(root, "apps", "web"), { recursive: true });
await writeFile(webEnvPath, env, "utf8");

console.log("Environment ready: .env and apps/web/.env.local are synchronized.");
console.log("AUTH_SECRET and EVALUATION_WORKER_SECRET are configured.");
