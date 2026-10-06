import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageDir, "../..");
const envPath = join(repoRoot, ".env");

try {
  process.loadEnvFile?.(envPath);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured. Run 'pnpm env:setup' first.");
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("select pg_advisory_lock(hashtext('interview-platform:migrations'))");

  const files = [
    join(packageDir, "schema.sql"),
    ...(await readdir(join(packageDir, "migrations")))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort()
      .map((file) => join(packageDir, "migrations", file)),
  ];

  for (const file of files) {
    const sql = await readFile(file, "utf8");
    const name = file.slice(packageDir.length + 1).replaceAll("\\", "/");
    process.stdout.write(`Applying ${name}...\n`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
      process.stdout.write(`✓ ${name}\n`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration failed in ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await client.query("select pg_advisory_unlock(hashtext('interview-platform:migrations'))");
  console.log("Database schema and migrations are up to date.");
} finally {
  await client.end();
}
