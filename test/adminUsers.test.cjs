const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { installFakeDb, startApp } = require("./helpers.cjs");

const calls = [];
const adminHash = bcrypt.hashSync("mdp-actuel-12", 4);
let emailTaken = false;
let customerRow = null;
let adminCount = 2;
let adminExists = false;
let deletedAdmin = true;

installFakeDb(async (text, params = []) => {
  const sql = text.replace(/\s+/g, " ");
  calls.push({ text: sql, params });
  if (sql.includes("SELECT token_version FROM admins")) return { rows: [{ token_version: 0 }] };
  if (sql.includes("SELECT * FROM admins WHERE id")) return { rows: [{ id: 1, email: "genni@example.com", password_hash: adminHash, token_version: 0 }] };
  if (sql.includes("SELECT id FROM admins WHERE email = $1 AND id <> $2")) return { rows: emailTaken ? [{ id: 2 }] : [] };
  if (sql.includes("UPDATE admins SET email")) return { rows: [{ id: 1, email: params[0] }] };
  if (sql.includes("UPDATE admins SET password_hash")) return { rows: [{ id: 1, email: "genni@example.com", token_version: 1 }] };
  if (sql.includes("FROM customers c") && sql.includes("COUNT(*)::int AS n")) return { rows: [{ n: 1 }] };
  if (sql.includes("FROM customers c")) {
    return { rows: [{ id: 5, name: "Marie", email: "marie@example.com", phone: "0696", created_at: "2026-11-01", email_verified: true, orders: 3 }] };
  }
  if (sql.includes("SELECT id, email FROM customers WHERE id")) return { rows: customerRow ? [customerRow] : [] };
  if (sql.includes("SELECT id, email, created_at FROM admins")) {
    return { rows: [{ id: 1, email: "genni@example.com", created_at: "2026-10-01" }, { id: 2, email: "aide@example.com", created_at: "2026-11-01" }] };
  }
  if (sql.includes("SELECT COUNT(*)::int AS n FROM admins")) return { rows: [{ n: adminCount }] };
  if (sql.includes("SELECT id FROM admins WHERE email = $1")) return { rows: adminExists ? [{ id: 9 }] : [] };
  if (sql.includes("INSERT INTO admins")) return { rows: [{ id: 7, email: params[0], created_at: "2026-11-02" }] };
  if (sql.includes("DELETE FROM admins")) return { rows: deletedAdmin ? [{ id: params[0] }] : [] };
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
  emailTaken = false;
  customerRow = { id: 5, email: "marie@example.com" };
  adminCount = 2;
  adminExists = false;
  deletedAdmin = true;
});

const cookie = () => `admin_token=${signToken({ sub: 1, role: "admin", v: 0 })}`;

test("tout est réservé aux administrateurs", async () => {
  for (const [method, path] of [
    ["GET", "/api/admin/account"],
    ["PATCH", "/api/admin/account/email"],
    ["POST", "/api/admin/account/password"],
    ["GET", "/api/admin/users/customers"],
    ["DELETE", "/api/admin/users/customers/5"],
    ["GET", "/api/admin/users/admins"],
    ["POST", "/api/admin/users/admins"],
    ["DELETE", "/api/admin/users/admins/2"]
  ]) {
    assert.equal((await app.request(method, path)).status, 401, `${method} ${path}`);
  }
});

test("compte admin : changer d'email exige le mot de passe actuel", async () => {
  const wrong = await app.request("PATCH", "/api/admin/account/email", { cookie: cookie(), body: { email: "nouveau@example.com", currentPassword: "faux" } });
  assert.equal(wrong.status, 400);
  assert.ok(!calls.some((c) => c.text.includes("UPDATE admins SET email")));

  const bad = await app.request("PATCH", "/api/admin/account/email", { cookie: cookie(), body: { email: "pas-un-email", currentPassword: "mdp-actuel-12" } });
  assert.equal(bad.status, 400);

  emailTaken = true;
  const taken = await app.request("PATCH", "/api/admin/account/email", { cookie: cookie(), body: { email: "aide@example.com", currentPassword: "mdp-actuel-12" } });
  assert.equal(taken.status, 409);

  emailTaken = false;
  const ok = await app.request("PATCH", "/api/admin/account/email", { cookie: cookie(), body: { email: " Nouveau@Example.com ", currentPassword: "mdp-actuel-12" } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.admin.email, "nouveau@example.com");
});

test("compte admin : changer de mot de passe révoque les autres sessions et garde celle-ci", async () => {
  const wrong = await app.request("POST", "/api/admin/account/password", { cookie: cookie(), body: { currentPassword: "faux", newPassword: "nouveau-mot-de-passe" } });
  assert.equal(wrong.status, 400);
  const short = await app.request("POST", "/api/admin/account/password", { cookie: cookie(), body: { currentPassword: "mdp-actuel-12", newPassword: "court" } });
  assert.equal(short.status, 400);

  const ok = await app.request("POST", "/api/admin/account/password", { cookie: cookie(), body: { currentPassword: "mdp-actuel-12", newPassword: "nouveau-mot-de-passe" } });
  assert.equal(ok.status, 200);
  const update = calls.find((c) => c.text.includes("UPDATE admins SET password_hash"));
  assert.match(update.text, /token_version = token_version \+ 1/);
  assert.ok(update.params[0].startsWith("$2"), "mot de passe haché");
  assert.match(ok.headers.get("set-cookie"), /admin_token=/);
});

test("clients : liste paginée avec recherche échappée", async () => {
  const res = await app.request("GET", "/api/admin/users/customers?q=50%25&page=2", { cookie: cookie() });
  assert.equal(res.status, 200);
  assert.equal(res.json.total, 1);
  assert.equal(res.json.customers[0].orders, 3);
  const list = calls.find((c) => c.text.includes("FROM customers c") && c.text.includes("LIMIT"));
  assert.match(list.text, /LIMIT 25 OFFSET 25/);
  assert.deepEqual(list.params, ["%50\\%%"]);
});

test("suppression d'un client : commandes conservées mais détachées du compte", async () => {
  const res = await app.request("DELETE", "/api/admin/users/customers/5", { cookie: cookie() });
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => c.text.includes("UPDATE orders SET customer_id = NULL WHERE customer_id = $1")));
  assert.ok(calls.some((c) => c.text.includes("DELETE FROM customers WHERE id = $1")));
  assert.ok(!calls.some((c) => c.text.includes("Client supprimé")), "pas d'anonymisation par défaut");
});

test("suppression d'un client avec effacement : ses commandes (compte et invité, même email) sont anonymisées", async () => {
  const res = await app.request("DELETE", "/api/admin/users/customers/5", { cookie: cookie(), body: { anonymizeOrders: true } });
  assert.equal(res.status, 200);
  const anonymize = calls.find((c) => c.text.includes("Client supprimé"));
  assert.ok(anonymize);
  assert.match(anonymize.text, /customer_id = \$1 OR \(email <> '' AND lower\(email\) = lower\(\$2\)\)/);
  assert.deepEqual(anonymize.params, [5, "marie@example.com"]);
  // L'anonymisation doit passer AVANT le détachement, sinon le lien avec le compte serait perdu.
  const order = calls.map((c) => c.text);
  assert.ok(order.findIndex((t) => t.includes("Client supprimé")) < order.findIndex((t) => t.includes("SET customer_id = NULL")));
});

test("suppression d'un client inconnu -> 404 ; id invalide -> 404", async () => {
  customerRow = null;
  assert.equal((await app.request("DELETE", "/api/admin/users/customers/99", { cookie: cookie() })).status, 404);
  assert.equal((await app.request("DELETE", "/api/admin/users/customers/abc", { cookie: cookie() })).status, 404);
});

test("administrateurs : liste avec repère du compte courant", async () => {
  const res = await app.request("GET", "/api/admin/users/admins", { cookie: cookie() });
  assert.deepEqual(res.json.admins.map((a) => [a.id, a.isSelf]), [[1, true], [2, false]]);
});

test("administrateurs : ajout validé (email, mot de passe, doublon)", async () => {
  const body = { email: "Aide@Example.com", password: "mot-de-passe-aide" };
  assert.equal((await app.request("POST", "/api/admin/users/admins", { cookie: cookie(), body: { ...body, email: "nope" } })).status, 400);
  assert.equal((await app.request("POST", "/api/admin/users/admins", { cookie: cookie(), body: { ...body, password: "court" } })).status, 400);

  adminExists = true;
  assert.equal((await app.request("POST", "/api/admin/users/admins", { cookie: cookie(), body })).status, 409);

  adminExists = false;
  const ok = await app.request("POST", "/api/admin/users/admins", { cookie: cookie(), body });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.admin.email, "aide@example.com");
  assert.ok(calls.find((c) => c.text.includes("INSERT INTO admins")).params[1].startsWith("$2"));
});

test("administrateurs : impossible de se supprimer soi-même ou de supprimer le dernier", async () => {
  const self = await app.request("DELETE", "/api/admin/users/admins/1", { cookie: cookie() });
  assert.equal(self.status, 400);
  assert.match(self.json.error, /propre compte/);

  adminCount = 1;
  const last = await app.request("DELETE", "/api/admin/users/admins/2", { cookie: cookie() });
  assert.equal(last.status, 400);
  assert.match(last.json.error, /au moins un administrateur/);
  assert.ok(!calls.some((c) => c.text.includes("DELETE FROM admins")));

  adminCount = 2;
  assert.equal((await app.request("DELETE", "/api/admin/users/admins/2", { cookie: cookie() })).status, 200);
  deletedAdmin = false;
  assert.equal((await app.request("DELETE", "/api/admin/users/admins/8", { cookie: cookie() })).status, 404);
});
