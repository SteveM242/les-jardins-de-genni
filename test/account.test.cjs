const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { installFakeDb, startApp } = require("./helpers.cjs");

const sentResets = [];
// Faux mailer : capture le lien de réinitialisation au lieu d'envoyer un email.
const mailerPath = require.resolve("../lib/mailer.cjs");
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendOrderEmail: async () => {},
    sendStatusEmail: async () => {},
    sendPasswordResetEmail: async (payload) => sentResets.push(payload),
    STATUS_MESSAGES: {},
    orderSummary: () => ""
  }
};

const calls = [];
const customerHash = bcrypt.hashSync("motdepasse-client", 4);
const adminHash = bcrypt.hashSync("motdepasse-admin", 4);
let resetRow = null;

installFakeDb(async (text, params = []) => {
  calls.push({ text: text.replace(/\s+/g, " "), params });
  const sql = text.replace(/\s+/g, " ");
  if (sql.includes("SELECT token_version FROM customers")) return { rows: [{ token_version: 0 }] };
  if (sql.includes("SELECT * FROM customers WHERE email")) {
    return {
      rows: params[0] === "marie@example.com" ? [{ id: 1, name: "Marie", email: "marie@example.com", password_hash: customerHash, token_version: 0 }] : []
    };
  }
  if (sql.includes("SELECT password_hash FROM admins WHERE email")) {
    return { rows: params[0] === "genni@example.com" ? [{ password_hash: adminHash }] : [] };
  }
  if (sql.includes("SELECT id FROM customers WHERE email")) return { rows: [] };
  if (sql.includes("SELECT id, name, email FROM customers WHERE email")) {
    return { rows: params[0] === "marie@example.com" ? [{ id: 1, name: "Marie", email: "marie@example.com" }] : [] };
  }
  if (sql.includes("INSERT INTO customers")) {
    return { rows: [{ id: 9, name: params[0], email: params[1], phone: params[2], address: null, token_version: 0 }] };
  }
  if (sql.includes("FROM password_resets WHERE token_hash")) return { rows: resetRow && params[0] === resetRow.hash ? [{ id: 5, customer_id: 1 }] : [] };
  if (sql.includes("UPDATE customers SET password_hash")) {
    return { rows: [{ id: 1, name: "Marie", email: "marie@example.com", token_version: 1 }] };
  }
  if (sql.includes("UPDATE customers SET name")) {
    return { rows: [{ id: 1, name: params[0], email: "marie@example.com", phone: params[1], address: params[2] }] };
  }
  if (sql.includes("SELECT * FROM customers WHERE id")) {
    return { rows: [{ id: 1, name: "Marie", email: "marie@example.com", password_hash: customerHash, token_version: 0 }] };
  }
  return { rows: [] };
});

const { signToken } = require("../auth.cjs");
let app;

test.before(async () => {
  app = await startApp();
});
test.after(() => app.close());
test.beforeEach(() => {
  calls.length = 0;
  sentResets.length = 0;
  resetRow = null;
});

const customerCookie = () => `customer_token=${signToken({ sub: 1, role: "customer", v: 0 })}`;

test("connexion : même réponse pour un email inconnu et un mauvais mot de passe", async () => {
  const unknown = await app.request("POST", "/api/auth/login", { body: { email: "personne@example.com", password: "nimportequoi" } });
  const wrong = await app.request("POST", "/api/auth/login", { body: { email: "marie@example.com", password: "mauvais-mot-de-passe" } });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(unknown.json, wrong.json);
});

test("connexion : l'email du compte pro n'est pas révélé avec un mauvais mot de passe", async () => {
  const res = await app.request("POST", "/api/auth/login", { body: { email: "genni@example.com", password: "devine" } });
  assert.equal(res.status, 401);
  assert.equal(res.json.error, "Email ou mot de passe incorrect.");
});

test("connexion : l'indice espace pro n'apparaît que si le mot de passe pro est correct", async () => {
  const res = await app.request("POST", "/api/auth/login", { body: { email: "genni@example.com", password: "motdepasse-admin" } });
  assert.equal(res.status, 401);
  assert.match(res.json.error, /espace pro/);
});

test("connexion réussie : cookie de session HttpOnly", async () => {
  const res = await app.request("POST", "/api/auth/login", { body: { email: "marie@example.com", password: "motdepasse-client" } });
  assert.equal(res.status, 200);
  assert.equal(res.json.customer.email, "marie@example.com");
  assert.match(res.headers.get("set-cookie"), /customer_token=.*HttpOnly/);
});

test("inscription : mot de passe de 8 à 72 caractères", async () => {
  const short = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "1234567" } });
  assert.equal(short.status, 400);
  const long = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "x".repeat(73) } });
  assert.equal(long.status, 400);
  const bad = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "pas-un-email", password: "12345678" } });
  assert.equal(bad.status, 400);
  const ok = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "12345678" } });
  assert.equal(ok.status, 200);
  assert.ok(calls.find((c) => c.text.includes("INSERT INTO customers")).params[3].startsWith("$2"), "mot de passe haché");
});

test("mot de passe oublié : même réponse pour un email connu ou inconnu, jeton stocké haché", async () => {
  const unknown = await app.request("POST", "/api/auth/forgot", { body: { email: "personne@example.com" } });
  assert.deepEqual(unknown.json, { ok: true });
  assert.equal(sentResets.length, 0);

  const known = await app.request("POST", "/api/auth/forgot", { body: { email: "marie@example.com" } });
  assert.deepEqual(known.json, { ok: true });
  assert.equal(sentResets.length, 1);

  const token = new URL(sentResets[0].url).searchParams.get("token");
  assert.match(token, /^[0-9a-f]{64}$/);
  const insert = calls.find((c) => c.text.includes("INSERT INTO password_resets"));
  assert.equal(insert.params[1], crypto.createHash("sha256").update(token).digest("hex"));
  assert.notEqual(insert.params[1], token);
});

test("réinitialisation : jeton valide -> nouveau mot de passe, sessions révoquées, jeton consommé", async () => {
  const token = "a".repeat(64);
  resetRow = { hash: crypto.createHash("sha256").update(token).digest("hex") };
  const res = await app.request("POST", "/api/auth/reset", { body: { token, password: "nouveau-mot-de-passe" } });
  assert.equal(res.status, 200);
  const update = calls.find((c) => c.text.includes("UPDATE customers SET password_hash"));
  assert.match(update.text, /token_version = token_version \+ 1/);
  assert.ok(calls.some((c) => c.text.includes("UPDATE password_resets SET used_at = now() WHERE customer_id")));
  assert.match(res.headers.get("set-cookie"), /customer_token=/);
});

test("réinitialisation : jeton inconnu ou mot de passe trop court refusés", async () => {
  const invalid = await app.request("POST", "/api/auth/reset", { body: { token: "zzz", password: "nouveau-mot-de-passe" } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.json.error, /invalide|expiré/);
  const short = await app.request("POST", "/api/auth/reset", { body: { token: "a".repeat(64), password: "court" } });
  assert.equal(short.status, 400);
});

test("changement de mot de passe : exige le mot de passe actuel et révoque les autres sessions", async () => {
  const wrong = await app.request("POST", "/api/account/password", {
    cookie: customerCookie(),
    body: { currentPassword: "pas-le-bon", newPassword: "nouveau-mot-de-passe" }
  });
  assert.equal(wrong.status, 400);

  const ok = await app.request("POST", "/api/account/password", {
    cookie: customerCookie(),
    body: { currentPassword: "motdepasse-client", newPassword: "nouveau-mot-de-passe" }
  });
  assert.equal(ok.status, 200);
  assert.match(calls.find((c) => c.text.includes("UPDATE customers SET password_hash")).text, /token_version \+ 1/);
  assert.match(ok.headers.get("set-cookie"), /customer_token=/);
});

test("profil : modification du nom, téléphone et adresse (session requise)", async () => {
  assert.equal((await app.request("PATCH", "/api/account", { body: { name: "X" } })).status, 401);
  const res = await app.request("PATCH", "/api/account", {
    cookie: customerCookie(),
    body: { name: "Marie D.", phone: "0696111111", address: "Fort-de-France" }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.customer.address, "Fort-de-France");
  const empty = await app.request("PATCH", "/api/account", { cookie: customerCookie(), body: { name: "  " } });
  assert.equal(empty.status, 400);
});
