import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

const { Pool } = pg;

let db: any;
let pool: any;

// Use PostgreSQL if DATABASE_URL is set, otherwise use SQLite
if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  // Fallback to SQLite for local development
  const sqlite = new Database("abuseapp.db");
  db = drizzleSqlite(sqlite, { schema });
  pool = null;
}

export { db, pool };
