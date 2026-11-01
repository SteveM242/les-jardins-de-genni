const { Pool, types } = require("pg");

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false
});

function query(text, params) {
  return pool.query(text, params);
}

// Exécute fn(client) dans une transaction : COMMIT si elle réussit, ROLLBACK sinon.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
