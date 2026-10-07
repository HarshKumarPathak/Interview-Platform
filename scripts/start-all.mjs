import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify((await import("node:child_process")).execFile);

const root = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const docker = isWindows ? "docker.exe" : "docker";
const python = isWindows ? "python.exe" : "python3";
const pidFile = join(root, ".dev-pids.json");
const webUrl = "http://127.0.0.1:3000/login";
const optional = process.argv.includes("--all-services") || /^(1|true|yes)$/i.test(process.env.START_OPTIONAL_SERVICES || "");

function fail(message) {
  console.error(`\n[start:all] ERROR: ${message}\n`);
  process.exit(1);
}

async function command(args, options = {}) {
  try {
    const { stdout = "", stderr = "" } = await execFile(args[0], args.slice(1), {
      cwd: root,
      windowsHide: true,
      ...options,
    });
    return { stdout, stderr };
  } catch (error) {
    const detail = error?.stderr || error?.stdout || error?.message || String(error);
    throw new Error(detail.trim());
  }
}

async function requireCommand(name, args, friendly) {
  try {
    await command([name, ...args]);
  } catch {
    fail(friendly);
  }
}

function versionAtLeast(version, major, minor = 0) {
  const match = String(version).match(/v?(\d+)\.(\d+)/);
  if (!match) return false;
  return Number(match[1]) > major || (Number(match[1]) === major && Number(match[2]) >= minor);
}

async function checkPrerequisites() {
  const nodeOk = versionAtLeast(process.version, 22);
  if (!nodeOk) fail(`Node.js 22+ is required. Detected ${process.version}. Install/update Node.js and retry.`);

  await requireCommand(pnpm, ["--version"], "pnpm 10+ is required. Install pnpm with 'corepack enable' or update your pnpm installation.");
  const pnpmVersionOutput = (await command([pnpm, "--version"])).stdout.trim();
  const pnpmMajor = Number.parseInt(pnpmVersionOutput.split(".")[0].replace(/^v/, ""), 10);
  if (!Number.isFinite(pnpmMajor) || pnpmMajor < 10) {
    fail(`pnpm 10+ is required. Detected ${pnpmVersionOutput || "an unknown version"}.`);
  }

  await requireCommand(docker, ["compose", "version"], "Docker Desktop with Docker Compose is required. Start Docker Desktop and retry.");
  try {
    await command([docker, "info"]);
  } catch {
    fail("Docker Desktop is installed but the Docker daemon is not running. Start Docker Desktop, wait for it to become ready, and retry.");
  }
}

async function setupEnvironment() {
  console.log("[start:all] Preparing local environment...");
  await command([pnpm, "env:setup"]);
}

async function startInfrastructure() {
  console.log("[start:all] Starting PostgreSQL and Redis...");
  await command([docker, "compose", "up", "-d", "postgres", "redis"]);

  const { stdout } = await command([docker, "compose", "ps", "-q", "postgres"]);
  const containerId = stdout.trim();
  if (!containerId) fail("PostgreSQL container could not be found after docker compose up.");

  console.log("[start:all] Waiting for PostgreSQL health check...");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const health = (await command([docker, "inspect", "-f", "{{.State.Health.Status}}", containerId])).stdout.trim();
      if (health === "healthy") {
        console.log("[start:all] PostgreSQL is healthy.");
        return;
      }
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  await command([docker, "compose", "ps"]);
  fail("PostgreSQL did not become healthy within 90 seconds. Run 'docker compose logs postgres' for details.");
}

async function workspaceManifests() {
  const dirs = ["apps", "services", "packages"];
  const files = [join(root, "package.json"), join(root, "pnpm-workspace.yaml"), join(root, "pnpm-lock.yaml")];
  for (const dir of dirs) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    for (const child of await readdir(base, { withFileTypes: true })) {
      if (child.isDirectory()) files.push(join(base, child.name, "package.json"));
    }
  }
  return files.filter(existsSync);
}

async function needsInstall() {
  const marker = join(root, "node_modules", ".modules.yaml");
  if (!existsSync(marker)) return true;

  const markerMtime = (await stat(marker)).mtimeMs;
  for (const file of await workspaceManifests()) {
    if ((await stat(file)).mtimeMs > markerMtime) return true;
  }

  const required = [
    join(root, "apps", "web", "node_modules", "next", "package.json"),
    join(root, "packages", "database", "node_modules", "pg", "package.json"),
  ];
  return required.some((file) => !existsSync(file));
}

async function installDependencies() {
  if (!(await needsInstall())) {
    console.log("[start:all] Dependencies are already installed; skipping pnpm install.");
    return;
  }

  const lockfile = join(root, "pnpm-lock.yaml");
  const args = ["install", "--prefer-offline"];
  if (existsSync(lockfile)) args.push("--frozen-lockfile");
  else args.push("--no-frozen-lockfile");

  // OneDrive can lock pnpm's virtual store while it is being synchronized.
  // Keep the virtual store outside OneDrive without deleting the project's node_modules.
  if (isWindows && /OneDrive/i.test(root)) {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      args.push("--config.virtual-store-dir=" + join(localAppData, "Interview-Platform", "pnpm-virtual-store"));
      console.log("[start:all] OneDrive detected; using an external pnpm virtual store to avoid EBUSY file-locking.");
    }
  }

  console.log("[start:all] Installing workspace dependencies...");
  try {
    await command([pnpm, ...args]);
  } catch (error) {
    const message = String(error.message || error);
    if (/EBUSY|EPERM|rename/i.test(message)) {
      fail("pnpm was blocked by a Windows file lock (often OneDrive/antivirus). Close VS Code terminals/processes using this repo, pause OneDrive syncing for this folder, and run 'pnpm start:all' again. Do not delete node_modules routinely.");
    }
    fail("pnpm install failed. " + message);
  }
}

async function migrateDatabase() {
  console.log("[start:all] Applying database schema and migrations...");
  await command([pnpm, "db:migrate"]);
}

function spawnDev(label, commandName, args, cwd = root) {
  const child = spawn(commandName, args, {
    cwd,
    stdio: "inherit",
    windowsHide: false,
    shell: isWindows,
    env: { ...process.env },
  });
  console.log(`[start:all] Started ${label} (PID ${child.pid}).`);
  child.on("exit", (code, signal) => {
    if (code && code !== 0) console.error(`[start:all] ${label} exited with code ${code}.`);
    else if (signal) console.log(`[start:all] ${label} stopped (${signal}).`);
  });
  return child;
}

async function waitForWeb(child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail("The web app exited before http://localhost:3000 became ready. Check the web app output above.");
    try {
      const response = await fetch(webUrl);
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  fail("The web app did not become ready within 90 seconds.");
}

async function openBrowser() {
  if (isWindows) {
    await command(["cmd.exe", "/c", "start", "", "http://localhost:3000"]);
  } else if (process.platform === "darwin") {
    await command(["open", "http://localhost:3000"]);
  } else {
    await command(["xdg-open", "http://localhost:3000"]);
  }
}

async function main() {
  console.log("\n=== Interview Platform: start:all ===\n");
  await checkPrerequisites();
  await setupEnvironment();
  await startInfrastructure();
  await installDependencies();
  await migrateDatabase();

  const children = [];
  const web = spawnDev("web", pnpm, ["--filter", "@interview-platform/web", "dev"]);
  children.push(web);
  await waitForWeb(web);

  if (optional) {
    try {
      await command([python, "--version"]);
    } catch {
      fail("Optional services were requested, but Python is not available. Install Python 3.12+ or run 'pnpm start:all' without --all-services.");
    }
    children.push(spawnDev("AI engine", python, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"], join(root, "services", "ai-engine")));
    children.push(spawnDev("realtime agent", python, ["agent.py", "start"], join(root, "services", "realtime-agent")));
    children.push(spawnDev("evaluation worker", pnpm, ["--filter", "@interview-platform/evaluation-worker", "start"]));
  }

  await writeFile(pidFile, JSON.stringify(children.map((child) => child.pid).filter(Boolean), null, 2) + "\n");
  console.log("\n[start:all] Ready: http://localhost:3000");
  console.log(optional ? "[start:all] Optional services are running too." : "[start:all] Web + PostgreSQL + Redis are running. Use --all-services to start Python/worker services.");
  console.log("[start:all] Stop with 'pnpm stop:all' or the VS Code Stop task.");
  await openBrowser();

  const shutdown = async () => {
    for (const child of children.reverse()) {
      if (child.exitCode === null) child.kill();
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {});
}

main().catch((error) => fail(error?.message || String(error)));
