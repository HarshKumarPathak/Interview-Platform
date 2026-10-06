import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export type Candidate = {
  id: string;
  email: string;
  display_name: string;
  headline: string | null;
  college: string | null;
  degree: string | null;
  graduation_year: number | null;
};
