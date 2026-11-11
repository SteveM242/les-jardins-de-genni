const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { installFakeDb, startApp } = require("./helpers.cjs");

const sentResets = [];
const sentVerifications = [];
// Faux mailer : capture le lien de réinitialisation au lieu d'envoyer un email.
const mailerPath = require.resolve("../lib/mailer.cjs");
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    isConfigured: () => false,
    sendVerificationEmail: async (payload) => sentVerifications.push(payload),
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
let verifyRow = null;
let linkedOrders = [];
let orderRow = null;
let verifiedEmail = false;

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
  if (sql.includes("SELECT id FROM customers WHERE email")) return { rows: params[0] === "pris@example.com" ? [{ id: 4 }] : [] };
  if (sql.includes("SELECT id, name, email FROM customers WHERE email")) {
    return { rows: params[0] === "marie@example.com" ? [{ id: 1, name: "Marie", email: "marie@example.com" }] : [] };
  }
  if (sql.includes("INSERT INTO customers")) {
    return { rows: [{ id: 9, name: params[0], email: params[1], phone: params[2], address: null, token_version: 0, email_verified_at: null }] };
  }
  if (sql.includes("FROM email_verifications WHERE token_hash")) {
    return { rows: verifyRow && params[0] === verifyRow.hash ? [{ id: 3, customer_id: 1, email: "marie@example.com" }] : [] };
  }
  if (sql.includes("UPDATE customers SET email_verified_at")) return { rows: [{ id: 1, email: "marie@example.com" }] };
  if (sql.includes("UPDATE orders SET customer_id = $1 WHERE customer_id IS NULL AND email")) return { rows: linkedOrders };
  if (sql.includes("FROM orders WHERE order_number")) return { rows: orderRow && params[0] === orderRow.order_number ? [orderRow] : [] };
  if (sql.includes("FROM password_resets WHERE token_hash")) return { rows: resetRow && params[0] === resetRow.hash ? [{ id: 5, customer_id: 1 }] : [] };
  if (sql.includes("UPDATE customers SET password_hash")) {
    return { rows: [{ id: 1, name: "Marie", email: "marie@example.com", token_version: 1 }] };
  }
  if (sql.includes("UPDATE customers SET name")) {
    return { rows: [{ id: 1, name: params[0], email: "marie@example.com", phone: params[1], address: params[2], default_fulfillment: params[3] || "retrait", email_verified_at: verifiedEmail ? "2026-01-01" : null }] };
  }
  if (sql.includes("UPDATE customers SET email = $1")) {
    return { rows: [{ id: 1, name: "Marie", email: params[0], email_verified_at: null }] };
  }
  if (sql.includes("SELECT * FROM customers WHERE id")) {
    return { rows: [{ id: 1, name: "Marie", email: "marie@example.com", password_hash: customerHash, token_version: 0, email_verified_at: verifiedEmail ? "2026-01-01" : null }] };
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
  sentVerifications.length = 0;
  resetRow = null;
  verifyRow = null;
  linkedOrders = [];
  orderRow = null;
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
  const short = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "1234567", acceptTerms: true } });
  assert.equal(short.status, 400);
  const long = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "x".repeat(73), acceptTerms: true } });
  assert.equal(long.status, 400);
  const bad = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "pas-un-email", password: "12345678", acceptTerms: true } });
  assert.equal(bad.status, 400);
  const ok = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "12345678", acceptTerms: true } });
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

test("inscription : les conditions doivent être acceptées, l'adresse est enregistrée", async () => {
  const refused = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "12345678" } });
  assert.equal(refused.status, 400);
  assert.match(refused.json.error, /conditions/);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO customers")));
  await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "12345678", address: "Ducos", acceptTerms: true } });
  assert.equal(calls.find((c) => c.text.includes("INSERT INTO customers")).params[4], "Ducos");
});

test("préférences : mode par défaut, rappel du lundi (email confirmé requis)", async () => {
  verifiedEmail = true;
  const res = await app.request("PATCH", "/api/account", {
    cookie: customerCookie(),
    body: { name: "Marie", defaultFulfillment: "livraison", reminder: true }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.customer.defaultFulfillment, "livraison");
  assert.equal(res.json.customer.reminder, true);
  assert.equal(calls.find((c) => c.text.includes("INSERT INTO reminder_subscribers")).params[0], "marie@example.com");

  calls.length = 0;
  const off = await app.request("PATCH", "/api/account", { cookie: customerCookie(), body: { name: "Marie", reminder: false } });
  assert.equal(off.json.customer.reminder, false);
  assert.ok(calls.some((c) => c.text.includes("DELETE FROM reminder_subscribers")));

  verifiedEmail = false;
  const refused = await app.request("PATCH", "/api/account", { cookie: customerCookie(), body: { name: "Marie", reminder: true } });
  assert.equal(refused.status, 400);
  assert.match(refused.json.error, /Confirmez/);
});

test("changer d'email : mot de passe exigé, doublon refusé, nouvelle adresse à confirmer", async () => {
  const body = (extra) => ({ cookie: customerCookie(), body: { email: "nouveau@example.com", currentPassword: "motdepasse-client", ...extra } });
  assert.equal((await app.request("PATCH", "/api/account/email", { body: { email: "x@example.com" } })).status, 401);
  assert.equal((await app.request("PATCH", "/api/account/email", body({ currentPassword: "faux" }))).status, 400);
  assert.equal((await app.request("PATCH", "/api/account/email", body({ email: "pas-un-email" }))).status, 400);
  assert.equal((await app.request("PATCH", "/api/account/email", body({ email: "marie@example.com" }))).status, 400);
  assert.equal((await app.request("PATCH", "/api/account/email", body({ email: "pris@example.com" }))).status, 409);
  calls.length = 0;
  const ok = await app.request("PATCH", "/api/account/email", body());
  assert.equal(ok.status, 200);
  assert.equal(ok.json.customer.emailVerified, false);
  assert.ok(calls.some((c) => c.text.includes("INSERT INTO email_verifications")));
  assert.equal(sentVerifications[0].to, "nouveau@example.com");
});

test("supprimer mon compte : mot de passe exigé ; commandes détachées, effacées si demandé", async () => {
  assert.equal((await app.request("DELETE", "/api/account", { body: { currentPassword: "x" } })).status, 401);
  const wrong = await app.request("DELETE", "/api/account", { cookie: customerCookie(), body: { currentPassword: "faux" } });
  assert.equal(wrong.status, 400);
  assert.ok(!calls.some((c) => c.text.includes("DELETE FROM customers")));

  const keep = await app.request("DELETE", "/api/account", { cookie: customerCookie(), body: { currentPassword: "motdepasse-client" } });
  assert.equal(keep.status, 200);
  assert.match(keep.headers.get("set-cookie"), /customer_token=;/);
  assert.ok(calls.some((c) => c.text.includes("UPDATE orders SET customer_id = NULL")));
  assert.ok(!calls.some((c) => c.text.includes("Client supprimé")));

  calls.length = 0;
  await app.request("DELETE", "/api/account", { cookie: customerCookie(), body: { currentPassword: "motdepasse-client", eraseOrders: true } });
  assert.ok(calls.some((c) => c.text.includes("Client supprimé")));
  assert.ok(calls.some((c) => c.text.includes("DELETE FROM customers WHERE id")));
});

const hashOf = (token) => crypto.createHash("sha256").update(token).digest("hex");

test("inscription : un lien de vérification est créé (jeton haché) et la réponse indique si l'email part", async () => {
  const res = await app.request("POST", "/api/auth/signup", { body: { name: "Paul", email: "paul@example.com", password: "12345678", acceptTerms: true } });
  assert.equal(res.status, 200);
  assert.equal(res.json.customer.emailVerified, false);
  assert.equal(res.json.verificationEmailSent, false);
  const insert = calls.find((c) => c.text.includes("INSERT INTO email_verifications"));
  assert.match(insert.params[2], /^[0-9a-f]{64}$/);
  const token = new URL(sentVerifications[0].url).searchParams.get("token");
  assert.equal(insert.params[2], hashOf(token));
});

test("vérification de l'email : marque le compte vérifié puis rattache les commandes invité de cet email", async () => {
  const token = "b".repeat(64);
  verifyRow = { hash: hashOf(token) };
  linkedOrders = [{ order_number: "AAA" }, { order_number: "BBB" }];
  const res = await app.request("POST", "/api/auth/verify", { body: { token } });
  assert.equal(res.status, 200);
  assert.equal(res.json.linked, 2);
  assert.ok(calls.some((c) => c.text.includes("UPDATE email_verifications SET used_at")));
  const link = calls.find((c) => c.text.includes("UPDATE orders SET customer_id = $1 WHERE customer_id IS NULL AND email"));
  assert.match(link.text, /lower\(email\) = lower\(\$2\)/);
  assert.deepEqual(link.params, [1, "marie@example.com"]);
});

test("vérification de l'email : un jeton inconnu ne rattache rien", async () => {
  const res = await app.request("POST", "/api/auth/verify", { body: { token: "n'importe quoi" } });
  assert.equal(res.status, 400);
  assert.ok(!calls.some((c) => c.text.includes("UPDATE orders")));
});

test("réinitialisation du mot de passe : prouve aussi l'email et rattache les commandes", async () => {
  const token = "c".repeat(64);
  resetRow = { hash: hashOf(token) };
  const res = await app.request("POST", "/api/auth/reset", { body: { token, password: "nouveau-mot-de-passe" } });
  assert.equal(res.status, 200);
  assert.match(calls.find((c) => c.text.includes("UPDATE customers SET password_hash")).text, /email_verified_at = COALESCE/);
  assert.ok(calls.some((c) => c.text.includes("UPDATE orders SET customer_id = $1 WHERE customer_id IS NULL AND email")));
});

test("renvoi du lien de vérification : session requise", async () => {
  assert.equal((await app.request("POST", "/api/account/resend-verification")).status, 401);
  const res = await app.request("POST", "/api/account/resend-verification", { cookie: customerCookie() });
  assert.equal(res.status, 200);
  assert.equal(sentVerifications.length, 1);
});

test("retrouver une commande sans email : numéro + téléphone (formats différents acceptés)", async () => {
  orderRow = { id: 40, order_number: "A1B2C3D4", customer_id: null, phone: "0696 12 34 56" };
  const ok = await app.request("POST", "/api/account/claim-order", {
    cookie: customerCookie(),
    body: { orderNumber: " a1b2-c3d4 ", phone: "+596 696 12 34 56" }
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.orderNumber, "A1B2C3D4");
  const update = calls.find((c) => c.text.includes("UPDATE orders SET customer_id = $1 WHERE id = $2"));
  assert.deepEqual(update.params, [1, 40]);
});

test("retrouver une commande : mauvais téléphone, numéro inconnu ou commande d'un autre compte donnent la même réponse", async () => {
  const request = () =>
    app.request("POST", "/api/account/claim-order", {
      cookie: customerCookie(),
      body: { orderNumber: "A1B2C3D4", phone: "0696123456" }
    });

  orderRow = { id: 40, order_number: "A1B2C3D4", customer_id: null, phone: "0696999999" };
  const wrongPhone = await request();

  orderRow = null;
  const unknown = await request();

  orderRow = { id: 40, order_number: "A1B2C3D4", customer_id: 77, phone: "0696123456" };
  const taken = await request();

  for (const res of [wrongPhone, unknown, taken]) assert.equal(res.status, 404);
  assert.deepEqual(wrongPhone.json, unknown.json);
  assert.deepEqual(unknown.json, taken.json);
  assert.ok(!calls.some((c) => c.text.includes("UPDATE orders SET customer_id = $1 WHERE id = $2")));
});

test("retrouver une commande : refusé sans session, et idempotent pour sa propre commande", async () => {
  assert.equal((await app.request("POST", "/api/account/claim-order", { body: { orderNumber: "X", phone: "0696123456" } })).status, 401);
  orderRow = { id: 40, order_number: "A1B2C3D4", customer_id: 1, phone: "0696123456" };
  const mine = await app.request("POST", "/api/account/claim-order", {
    cookie: customerCookie(),
    body: { orderNumber: "A1B2C3D4", phone: "0000000000" }
  });
  assert.equal(mine.json.alreadyYours, true);
});
