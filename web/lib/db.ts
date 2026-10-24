import postgres from "postgres";

/**
 * One Postgres pool per server instance. Uses Supabase's transaction pooler,
 * which does not support prepared statements, hence prepare: false.
 */
declare global {
  // eslint-disable-next-line no-var
  var __finurheiluSql: postgres.Sql | undefined;
}

export const sql: postgres.Sql =
  globalThis.__finurheiluSql ??
  postgres(process.env.DATABASE_URL ?? "postgres://localhost/finurheilu", {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalThis.__finurheiluSql = sql;

/**
 * Run reader queries as the `anon` role so the database's row-level security
 * decides what is visible. Drafts can never leak to the app, even if a query
 * here forgets a filter.
 */
export async function asReader<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`set local role anon`;
    return fn(tx);
  });
  return result as T;
}
