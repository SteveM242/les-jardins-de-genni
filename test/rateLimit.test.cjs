const test = require("node:test");
const assert = require("node:assert/strict");
const { installFakeDb, startApp } = require("./helpers.cjs");

installFakeDb(async () => ({ rows: [] }));

test("la connexion admin est limitée après 10 échecs", async () => {
  const app = await startApp();
  try {
    const statuses = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await app.request("POST", "/api/admin/login", { body: { email: "a@b.c", password: "mauvais" } });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.equal(statuses[10], 429);
    assert.equal(statuses[11], 429);
  } finally {
    await app.close();
  }
});
