import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL belum diisi.");
  }
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  return url.toString();
}

const sql =
  globalForDb.sql ??
  postgres(connectionString(), {
    ssl: "require",
    max: 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
