const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureAdmin } = require("../lib/adminBootstrap.cjs");

function setup(existingAdmins) {
  const calls = [];
  const query = async (text, params = []) => {
    calls.push({ text: text.replace(/\s+/g, " "), params });
    if (text.includes("SELECT id FROM admins")) return { rows: existingAdmins };
    return { rows: [] };
  };
  return { calls, args: (env) => ({ query, hashPassword: async (p) => `hash(${p})`, env, log: () => {} }) };
}

test("table admins vide : le compte est créé depuis l'environnement", async () => {
  const { calls, args } = setup([]);
  const result = await ensureAdmin(args({ ADMIN_EMAIL: " Genni@Example.com ", ADMIN_PASSWORD: "secret-12345" }));
  assert.equal(result, "created");
  const insert = calls.find((c) => c.text.startsWith("INSERT INTO admins"));
  assert.deepEqual(insert.params, ["genni@example.com", "hash(secret-12345)"]);
});

test("un admin existe déjà : l'environnement ne réécrit PAS ses accès (ses changements sont conservés)", async () => {
  const { calls, args } = setup([{ id: 4 }]);
  const result = await ensureAdmin(args({ ADMIN_EMAIL: "autre@example.com", ADMIN_PASSWORD: "ancien-mot-de-passe" }));
  assert.equal(result, "kept");
  assert.ok(!calls.some((c) => c.text.startsWith("INSERT") || c.text.startsWith("UPDATE")));
});

test("ADMIN_FORCE_RESET : réinitialise le plus ancien admin et coupe ses sessions", async () => {
  const { calls, args } = setup([{ id: 4 }]);
  const result = await ensureAdmin(args({ ADMIN_EMAIL: "genni@example.com", ADMIN_PASSWORD: "nouveau-12345", ADMIN_FORCE_RESET: "true" }));
  assert.equal(result, "reset");
  const update = calls.find((c) => c.text.startsWith("UPDATE admins"));
  assert.match(update.text, /token_version = token_version \+ 1/);
  assert.deepEqual(update.params, ["genni@example.com", "hash(nouveau-12345)", 4]);
});

test("variables absentes : rien n'est fait", async () => {
  const { calls, args } = setup([]);
  assert.equal(await ensureAdmin(args({})), "skipped");
  assert.equal(await ensureAdmin(args({ ADMIN_EMAIL: "a@b.c" })), "skipped");
  assert.equal(calls.length, 0);
});
