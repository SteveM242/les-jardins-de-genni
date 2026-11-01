const test = require("node:test");
const assert = require("node:assert/strict");
const { computeStats } = require("../lib/stats.cjs");
const { installFakeDb, startApp } = require("./helpers.cjs");

const NOW = new Date("2026-11-30T12:00:00Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const orders = [
  { total: "20.00", status: "nouvelle", created_at: daysAgo(1), items: [{ name: "Panier Découverte", qty: 2 }, { name: "Mangues", qty: 1 }] },
  { total: "12.50", status: "livree", created_at: daysAgo(6), items: [{ name: "Panier Découverte", qty: 1 }] },
  { total: "30.00", status: "livree", created_at: daysAgo(15), items: [{ name: "Ananas", qty: 3 }] },
  { total: "99.00", status: "annulee", created_at: daysAgo(2), items: [{ name: "Panier Géant", qty: 9 }] },
  { total: "50.00", status: "livree", created_at: daysAgo(45), items: [{ name: "Trop ancien", qty: 5 }] }
];

test("computeStats : 7 et 30 jours, annulées et trop anciennes exclues", () => {
  const stats = computeStats(orders, NOW);
  assert.deepEqual(stats.week, { orders: 2, revenue: 32.5 });
  assert.deepEqual(stats.month, { orders: 3, revenue: 62.5 });
});

test("computeStats : classement des articles les plus commandés", () => {
  const { top } = computeStats(orders, NOW);
  // Égalité à 3 : départage par ordre alphabétique.
  assert.deepEqual(top[0], { name: "Ananas", qty: 3 });
  assert.deepEqual(top[1], { name: "Panier Découverte", qty: 3 });
  assert.ok(!top.some((entry) => entry.name === "Panier Géant" || entry.name === "Trop ancien"));
});

test("computeStats : aucune commande ou données incomplètes", () => {
  assert.deepEqual(computeStats([], NOW), { week: { orders: 0, revenue: 0 }, month: { orders: 0, revenue: 0 }, top: [] });
  const odd = computeStats([{ total: null, status: "nouvelle", created_at: daysAgo(1), items: null }], NOW);
  assert.deepEqual(odd.week, { orders: 1, revenue: 0 });
});

installFakeDb(async (text) => {
  if (text.includes("SELECT token_version FROM admins")) return { rows: [{ token_version: 0 }] };
  if (text.includes("FROM orders WHERE created_at >= now()")) {
    return { rows: [{ total: "10.00", status: "nouvelle", created_at: new Date().toISOString(), items: [{ name: "Mangues", qty: 2 }] }] };
  }
  return { rows: [] };
});

test("GET /api/admin/stats : session requise, chiffres calculés", async () => {
  const { signToken } = require("../auth.cjs");
  const app = await startApp();
  try {
    assert.equal((await app.request("GET", "/api/admin/stats")).status, 401);
    const res = await app.request("GET", "/api/admin/stats", { cookie: `admin_token=${signToken({ sub: 1, role: "admin", v: 0 })}` });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.week, { orders: 1, revenue: 10 });
    assert.deepEqual(res.json.top, [{ name: "Mangues", qty: 2 }]);
  } finally {
    await app.close();
  }
});
