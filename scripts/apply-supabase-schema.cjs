const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is required.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  });

  try {
    await client.connect();
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../supabase/schema.sql"),
      "utf8",
    );
    await client.query("begin");
    await client.query(schema);
    await client.query("commit");
    console.info("Supabase schema migration applied.");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    console.error(`Supabase schema migration failed (${code}).`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
