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
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

function replaceOrAppend(text, key, value) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((entry) => entry.startsWith(`${key}=`));
  const line = `${key}=${value}`;
  if (index >= 0) {
    lines[index] = line;
    return lines.join("\n");
  }
  return `${text.trimEnd()}\n${line}\n`;
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

if (!readValue(env, "DATABASE_URL")) {
  env = replaceOrAppend(env, "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/interview_platform");
}

await writeFile(envPath, env, "utf8");
await mkdir(join(root, "apps", "web"), { recursive: true });
await writeFile(webEnvPath, env, "utf8");

console.log("Environment ready: .env and apps/web/.env.local are synchronized.");
console.log("AUTH_SECRET and EVALUATION_WORKER_SECRET are configured.");
