import { readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const exec = promisify(execFile);
const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const pidFile = join(root, ".dev-pids.json");
const isWindows = process.platform === "win32";
const docker = isWindows ? "docker.exe" : "docker";

async function run(file, args) {
  try { await exec(file, args, { cwd: root, windowsHide: true }); } catch (error) {
    const detail = error?.stderr || error?.stdout || error?.message || String(error);
    if (detail.trim()) console.warn(detail.trim());
  }
}

let pids = [];
try { pids = JSON.parse(await readFile(pidFile, "utf8")); } catch {}

for (const pid of pids) {
  if (!pid) continue;
  if (isWindows) await run("taskkill.exe", ["/PID", String(pid), "/T", "/F"]);
  else await run("kill", ["-TERM", String(pid)]);
}

try { await unlink(pidFile); } catch {}
console.log("[stop:all] Dev processes stopped.");
await run(docker, ["compose", "down"]);
console.log("[stop:all] Docker services stopped.");
