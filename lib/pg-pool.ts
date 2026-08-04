import { Pool } from "pg";

// Lazily-initialized, reused across warm serverless invocations — avoids
// opening a fresh Postgres connection on every request the way a one-off
// `new Pool()` per route handler would.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({
      // A `?sslmode=require` query param on the connection string makes pg
      // enforce full certificate-chain verification (newer pg versions
      // treat `require` as `verify-full`), which fails against Supabase's
      // pooler. Strip it and apply `ssl` as an explicit option instead.
      connectionString: connectionString.split("?")[0],
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
