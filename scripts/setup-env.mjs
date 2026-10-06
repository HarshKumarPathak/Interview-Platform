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

function replaceOrAppend(text, key, value) {
  const pattern = new RegExp(`^\\s*${key}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, `${key}=${value}`) : `${text.trimEnd()}\\n${key}=${value}\\n`;
}

if (!existsSync(envPath)) {
  await copyFile(examplePath, envPath);
  console.log("Created root .env from .env.example.");
}

let env = await readFile(envPath, "utf8");
env = replaceOrAppend(env, "AUTH_SECRET", randomSecret(48));
env = replaceOrAppend(env, "EVALUATION_WORKER_SECRET", randomSecret(64));

const databaseMatch = env.match(/^DATABASE_URL=(.*)$/m);
if (!databaseMatch?.[1]?.trim()) {
  env = replaceOrAppend(env, "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/interview_platform");
}

await writeFile(envPath, env, "utf8");
await mkdir(join(root, "apps", "web"), { recursive: true });
await writeFile(webEnvPath, env, "utf8");

console.log("Environment ready: .env and apps/web/.env.local are synchronized.");
console.log("AUTH_SECRET and EVALUATION_WORKER_SECRET are set to non-placeholder values.");
