const test = require("node:test");
const assert = require("node:assert/strict");
const { installFakeDb, startApp } = require("./helpers.cjs");

const calls = [];
let discountRow = null;
let revokedAdmin = false;
let orderByCode = { id: 7, order_number: "K7M4QH", name: "Awa", status: "prete" };
let insertFailures = 0;
let basketCurrent = { id: 3, items: ["Mangues"] };
let basketNameTaken = false;
const soldOutProducts = new Set();
const stocks = {}; // slug -> quantité disponible (absent = illimité)
let closeSessionRows = { ready: 2, unfinished: 1 };
let basketCurrentName = null;
const imageBase64 = Buffer.from("fake-image-bytes").toString("base64");

// Faux Postgres : répond selon un fragment du SQL, et garde la trace des requêtes.
installFakeDb(async (text, params = []) => {
  calls.push({ text, params });
  const sql = text.replace(/\s+/g, " ");
  if (sql.includes("SELECT token_version FROM admins")) return { rows: [{ token_version: revokedAdmin ? 1 : 0 }] };
  if (sql.includes("FROM products WHERE slug = ANY")) {
    const catalog = {
      igname: { slug: "igname", name: "Igname", unit: "kg", price: "10.00" },
      mangue: { slug: "mangue", name: "Mangues", unit: "kg", price: "3.50" }
    };
    return { rows: params[0].filter((slug) => catalog[slug]).map((slug) => ({ ...catalog[slug], sold_out: soldOutProducts.has(slug), stock: stocks[slug] ?? null })) };
  }
  if (sql.includes("SELECT name, stock FROM products WHERE slug = $1")) {
    return { rows: [{ name: params[0], stock: stocks[params[0]] ?? null }] };
  }
  if (sql.includes("FROM orders WHERE status = 'prete' AND notified_at IS NULL")) {
    return { rows: [{ id: 5, order_number: "ABC", name: "Awa", phone: "0696", total: "12.00", desired_date: "2026-11-18", fulfillment: "retrait" }] };
  }
  if (sql.includes("COUNT(*) FILTER (WHERE status = 'prete')")) return { rows: [closeSessionRows] };
  if (sql.includes("SELECT COUNT(*)::int AS n FROM products WHERE sold_out")) return { rows: [{ n: 3 }] };
  if (sql.includes("UPDATE orders SET status = 'non_retiree'")) return { rowCount: 2, rows: [] };
  if (sql.includes("UPDATE products SET sold_out = false")) return { rowCount: 3, rows: [] };
  if (sql.includes("SELECT id, composition FROM baskets WHERE composition IS NOT NULL")) {
    return { rows: [{ id: 3, composition: { maxItems: 2, entries: [{ name: "A", qty: 1, max: 2, kind: "base", soldOut: true }] } }] };
  }
  if (sql.includes("FROM site_settings WHERE key = 'last_backup'")) return { rows: [{ value: { at: "2026-11-01T10:00:00.000Z" } }] };
  if (sql.includes("SELECT * FROM orders ORDER BY id")) return { rows: [{ id: 1, order_number: "ABC" }] };
  if (sql.includes("SELECT id, total FROM orders WHERE order_number")) {
    return { rows: params[0] === "PAYME1" ? [{ id: 11, total: "20.00" }] : [] };
  }
  if (sql.includes("FROM baskets WHERE slug = ANY")) {
    const basket = { slug: "panier-decouverte", name: "Panier Découverte", price: "12.00", items: ["Mangues", "Christophines"] };
    const familial = {
      slug: "panier-familial",
      name: "Panier Familial",
      price: "34.00",
      items: ["Salade", "Oignons"],
      composition: {
        maxItems: 3,
        entries: [
          { name: "Salade", qty: 1, max: 2, kind: "base", note: "" },
          { name: "Poireaux", qty: 2, max: 2, kind: "base", note: "" },
          { name: "Oignons", qty: 0, max: 2, kind: "replacement", note: "" }
        ]
      }
    };
    return { rows: [basket, familial].filter((row) => params[0].includes(row.slug)) };
  }
  if (sql.includes("INSERT INTO orders") && insertFailures > 0) {
    insertFailures -= 1;
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  }
  if (sql.includes("FROM orders WHERE order_number")) return { rows: orderByCode && params[0] === orderByCode.order_number ? [orderByCode] : [] };
  if (sql.includes("SELECT id, items, composition FROM baskets WHERE id")) return { rows: basketCurrent ? [basketCurrent] : [] };
  if (sql.includes("lower(name) = lower")) return { rows: basketNameTaken || params[0] === "Panier Familial (copie)x" ? [{ "?column?": 1 }] : [] };
  if (sql.includes("SELECT name FROM baskets WHERE id")) return { rows: basketCurrentName ? [{ name: basketCurrentName }] : [] };
  if (sql.includes("INSERT INTO baskets") && sql.includes("SELECT $1, $2")) return { rows: [{ id: 9, slug: params[0], name: params[1], price: "34.00", active: false, items: [] }] };
  if (sql.includes("SELECT status FROM orders WHERE id")) return { rows: [{ status: "nouvelle" }] };
  if (sql.includes("UPDATE orders SET paid = true")) return { rows: [] };
  if (sql.includes("UPDATE orders SET")) return { rows: [{ id: 1, order_number: "ABC", name: "Awa", status: params[0] || "nouvelle", email: "", items: [{ type: "product", slug: "igname", qty: 2 }] }] };
  if (sql.includes("INSERT INTO reminder_subscribers")) return { rows: [] };
  if (sql.includes("DELETE FROM reminder_subscribers")) return { rowCount: params[0] === "a".repeat(32) ? 1 : 0, rows: [] };
  if (sql.includes("UPDATE baskets SET")) return { rows: [{ id: 3, name: params[0] || "Panier", price: params[1] || "10.00", active: params[5], items: [] }] };
  if (sql.includes("FROM discount_codes")) return { rows: discountRow ? [discountRow] : [] };
  if (sql.includes("SELECT image FROM products")) {
    return { rows: params[0] === "igname" ? [{ image: `data:image/png;base64,${imageBase64}` }] : [] };
  }
  if (sql.includes("FROM orders") && sql.includes("COUNT(*)::int AS n FROM orders WHERE")) return { rows: [{ n: 1 }] };
  if (sql.includes("GROUP BY status")) return { rows: [{ status: "nouvelle", n: 3 }, { status: "livree", n: 2 }] };
  if (sql.includes("SELECT * FROM orders")) return { rows: [{ id: 1, order_number: "ABC" }] };
  return { rows: [] };
});

const { signToken } = require("../auth.cjs");
const { clock } = require("../lib/salesWindow.cjs");
// Samedi 14 novembre 2026, 11 h à la Martinique : la vente est ouverte, retrait le mercredi 18.
const SATURDAY = new Date("2026-11-14T15:00:00Z");
clock.now = () => SATURDAY;
let app;

test.before(async () => {
  app = await startApp();
});
test.after(() => app.close());
test.beforeEach(() => {
  calls.length = 0;
  discountRow = null;
  revokedAdmin = false;
  insertFailures = 0;
  basketCurrent = { id: 3, items: ["Mangues"] };
  basketNameTaken = false;
});

const adminCookie = () => `admin_token=${signToken({ sub: 1, role: "admin", v: 0 })}`;

test("les en-têtes de sécurité sont présents", async () => {
  const res = await app.request("GET", "/api/nope");
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("une requête d'écriture venant d'une autre origine est refusée", async () => {
  const res = await app.request("POST", "/api/orders", { body: {}, headers: { origin: "https://evil.example" } });
  assert.equal(res.status, 403);
});

test("l'API admin exige une session", async () => {
  assert.equal((await app.request("GET", "/api/admin/orders")).status, 401);
  assert.equal((await app.request("PATCH", "/api/admin/orders/1", { body: { status: "prete" } })).status, 401);
});

test("une session admin révoquée (token_version) est refusée", async () => {
  revokedAdmin = true;
  const res = await app.request("GET", "/api/admin/orders", { cookie: adminCookie() });
  assert.equal(res.status, 401);
});

test("une commande est recalculée côté serveur, prix client ignoré", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer: { name: "Marie", phone: "0696000000", fulfillment: "retrait" },
      items: [{ type: "product", slug: "igname", qty: 2, price: 0.01 }]
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.subtotal, 20);
  assert.equal(res.json.total, 20);
  const insert = calls.find((c) => c.text.includes("INSERT INTO orders"));
  assert.ok(insert);
  assert.equal(insert.params[10], 20);
});

test("un code promo pourcentage est appliqué et son compteur incrémenté", async () => {
  discountRow = { id: 7, code: "BIENVENUE", type: "percent", value: "10", max_uses: null, used_count: 0, expires_at: null };
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer: { name: "Marie", phone: "0696000000" },
      items: [{ type: "product", slug: "igname", qty: 2 }],
      discountCode: "bienvenue"
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.discountAmount, 2);
  assert.equal(res.json.total, 18);
  assert.ok(calls.some((c) => c.text.includes("used_count = used_count + 1")));
});

test("un code promo invalide renvoie 400 et n'enregistre aucune commande", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer: { name: "Marie", phone: "0696000000" },
      items: [{ type: "product", slug: "igname", qty: 1 }],
      discountCode: "INCONNU"
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /invalide/);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));
});

test("la livraison exige une adresse", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer: { name: "Marie", phone: "0696000000", fulfillment: "livraison" },
      items: [{ type: "product", slug: "igname", qty: 1 }]
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /adresse/i);
});

const customer = { name: "Marie", phone: "0696000000" };

test("un article indisponible bloque la commande au lieu d'être ignoré en silence", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer,
      items: [
        { key: "a", type: "product", slug: "igname", qty: 1 },
        { key: "b", type: "product", slug: "inconnu", name: "Papaye", qty: 1 }
      ]
    }
  });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, "ITEMS_UNAVAILABLE");
  assert.deepEqual(res.json.unavailable.map((u) => u.name), ["Papaye"]);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));
});

test("un prix qui a changé depuis l'ajout au panier bloque la commande", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: { customer, items: [{ key: "a", type: "product", slug: "igname", qty: 1, expectedPrice: 8 }] }
  });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, "PRICES_CHANGED");
  assert.deepEqual(res.json.priceChanges, [{ key: "a", name: "Igname", previousPrice: 8, price: 10 }]);
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));
});

test("un panier sur mesure est valorisé depuis son contenu et son contenu est enregistré", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: {
      customer,
      items: [
        {
          key: "c1",
          type: "custom",
          name: "Panier de Marie",
          qty: 2,
          price: 0.01,
          contents: [{ slug: "igname", qty: 2 }, { slug: "mangue", qty: 3 }]
        }
      ]
    }
  });
  assert.equal(res.status, 200);
  // 2 x 10 + 3 x 3,50 = 30,50 par panier ; 2 paniers = 61
  assert.equal(res.json.total, 61);
  const insert = calls.find((c) => c.text.includes("INSERT INTO orders"));
  const stored = JSON.parse(insert.params[8]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].type, "custom");
  assert.equal(stored[0].name, "Panier de Marie");
  assert.equal(stored[0].price, 30.5);
  assert.deepEqual(stored[0].contents.map((c) => `${c.qty} ${c.name}`), ["2 Igname", "3 Mangues"]);
  assert.equal(stored[0].key, undefined);
});

test("un panier du catalogue enregistre son contenu au moment de la commande", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: { customer, items: [{ key: "b1", type: "basket", slug: "panier-decouverte", qty: 1 }] }
  });
  assert.equal(res.status, 200);
  const stored = JSON.parse(calls.find((c) => c.text.includes("INSERT INTO orders")).params[8]);
  assert.deepEqual(stored[0].contents, [{ name: "Mangues" }, { name: "Christophines" }]);
});

test("un panier sur mesure vide ou avec un article retiré du catalogue est refusé", async () => {
  const empty = await app.request("POST", "/api/orders", {
    body: { customer, items: [{ key: "c", type: "custom", name: "Vide", qty: 1, contents: [] }] }
  });
  assert.equal(empty.status, 409);
  const missing = await app.request("POST", "/api/orders", {
    body: { customer, items: [{ key: "c", type: "custom", name: "X", qty: 1, contents: [{ slug: "igname", qty: 1 }, { slug: "disparu", qty: 1 }] }] }
  });
  assert.equal(missing.status, 409);
  assert.match(missing.json.unavailable[0].reason, /indisponible/);
});

test("/api/cart/check relit les prix, signale indisponibilités et changements sans rien enregistrer", async () => {
  const res = await app.request("POST", "/api/cart/check", {
    body: {
      items: [
        { key: "a", type: "product", slug: "igname", qty: 2, expectedPrice: 9 },
        { key: "b", type: "product", slug: "inconnu", name: "Papaye", qty: 1 }
      ]
    }
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.subtotal, 20);
  assert.equal(res.json.lines[0].lineTotal, 20);
  assert.equal(res.json.unavailable[0].key, "b");
  assert.equal(res.json.priceChanges[0].previousPrice, 9);
  assert.ok(!calls.some((c) => c.text.includes("INSERT")));
});

test("le honeypot ignore silencieusement les robots", async () => {
  const res = await app.request("POST", "/api/orders", { body: { website: "http://spam" } });
  assert.equal(res.json.orderId, "spam-ignored");
  assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));
});

test("liste admin des commandes : pagination, filtre, recherche échappée et compteurs", async () => {
  const res = await app.request("GET", "/api/admin/orders?status=nouvelle&q=50%25&page=2", { cookie: adminCookie() });
  assert.equal(res.status, 200);
  assert.equal(res.json.page, 2);
  assert.equal(res.json.total, 1);
  assert.deepEqual(res.json.counts, { nouvelle: 3, confirmee: 0, prete: 0, livree: 2, non_retiree: 0, annulee: 0, all: 5 });
  const list = calls.find((c) => c.text.includes("SELECT * FROM orders"));
  assert.match(list.text, /LIMIT 20 OFFSET 20/);
  assert.deepEqual(list.params, ["nouvelle", "%50\\%%"]);
});

test("un id non numérique répond 404 sans toucher à la base", async () => {
  const res = await app.request("PATCH", "/api/admin/orders/abc", { cookie: adminCookie(), body: { status: "prete" } });
  assert.equal(res.status, 404);
  assert.ok(!calls.some((c) => c.text.includes("UPDATE orders")));
});

test("un statut invalide est refusé", async () => {
  const res = await app.request("PATCH", "/api/admin/orders/1", { cookie: adminCookie(), body: { status: "n'importe quoi" } });
  assert.equal(res.status, 400);
});

test("une photo uploadée est servie avec un cache long", async () => {
  const res = await app.request("GET", "/api/products/igname/image?v=123");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.match(res.headers.get("cache-control"), /immutable/);
  assert.equal(res.text, "fake-image-bytes");
  assert.equal((await app.request("GET", "/api/products/inconnu/image")).status, 404);
});

test("un pourcentage supérieur à 100 est refusé côté admin", async () => {
  const res = await app.request("POST", "/api/admin/discounts", {
    cookie: adminCookie(),
    body: { code: "FOU", type: "percent", value: 150 }
  });
  assert.equal(res.status, 400);
});

const orderBody = { customer: { name: "Marie", phone: "0696000000", desiredDate: "2030-01-01" }, items: [{ key: "a", type: "product", slug: "igname", qty: 1 }] };

test("session de vente : le retrait est le mercredi de la session, la date saisie est ignorée", async () => {
  const res = await app.request("POST", "/api/orders", { body: orderBody });
  assert.equal(res.status, 200);
  assert.equal(calls.find((c) => c.text.includes("INSERT INTO orders")).params[13], "2026-11-18");
});

test("session de vente : hors session (mercredi), la commande est refusée sans rien enregistrer", async () => {
  const previous = clock.now;
  clock.now = () => new Date("2026-11-11T15:00:00Z"); // mercredi
  try {
    const res = await app.request("POST", "/api/orders", { body: orderBody });
    assert.equal(res.status, 403);
    assert.equal(res.json.code, "SALES_CLOSED");
    assert.equal(res.json.sales.opensInDays, 3);
    assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));
    // La relecture du panier indique aussi que la vente est fermée.
    const check = await app.request("POST", "/api/cart/check", { body: { items: [] } });
    assert.equal(check.json.sales.open, false);
  } finally {
    clock.now = previous;
  }
});

test("liste de préparation : session admin requise, quantités agrégées", async () => {
  assert.equal((await app.request("GET", "/api/admin/orders/prep")).status, 401);
  const res = await app.request("GET", "/api/admin/orders/prep?date=2026-11-18", { cookie: adminCookie() });
  assert.equal(res.status, 200);
  assert.equal(res.json.date, "2026-11-18");
  const sql = calls.find((c) => c.text.includes("SELECT order_number, name, items FROM orders"));
  assert.deepEqual(sql.params, [["nouvelle", "confirmee", "prete"], "2026-11-18"]);
});

test("export CSV : session admin requise, en-têtes et séparateur", async () => {
  assert.equal((await app.request("GET", "/api/admin/orders/export.csv")).status, 401);
  const res = await app.request("GET", "/api/admin/orders/export.csv?from=2026-11-01&to=2026-11-30&status=livree", { cookie: adminCookie() });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(res.headers.get("content-disposition"), /commandes-.*\.csv/);
  assert.match(res.text, /Code;Date;Retrait prévu;Statut;Payée/);
  const sql = calls.find((c) => c.text.includes("SELECT * FROM orders WHERE"));
  assert.deepEqual(sql.params, ["2026-11-01", "2026-11-30", "livree"]);
});

const { http: paymentsHttp } = require("../lib/payments.cjs");
const crypto = require("node:crypto");

test("stock : quantité insuffisante signalée au panier, refusée à la commande, décrémentée sinon", async () => {
  stocks.igname = 2;
  try {
    const check = await app.request("POST", "/api/cart/check", { body: { items: [{ key: "a", type: "product", slug: "igname", qty: 3 }] } });
    assert.match(check.json.unavailable[0].reason, /Plus que 2/);
    stocks.igname = 0;
    const out = await app.request("POST", "/api/cart/check", { body: { items: [{ key: "a", type: "product", slug: "igname", qty: 1 }] } });
    assert.match(out.json.unavailable[0].reason, /rupture/);

    stocks.igname = 1;
    const refused = await app.request("POST", "/api/orders", { body: { customer: orderBody.customer, items: [{ key: "a", type: "product", slug: "igname", qty: 2 }] } });
    // Le panier est refusé dès la relecture (plus que 1) : jamais d'écriture.
    assert.equal(refused.status, 409);
    assert.ok(!calls.some((c) => c.text.includes("INSERT INTO orders")));

    stocks.igname = 5;
    calls.length = 0;
    const ok = await app.request("POST", "/api/orders", { body: { customer: orderBody.customer, items: [{ key: "a", type: "product", slug: "igname", qty: 2 }] } });
    assert.equal(ok.status, 200);
    const decrement = calls.find((c) => c.text.includes("UPDATE products SET stock = stock - $1"));
    assert.deepEqual(decrement.params, [2, "igname"]);
  } finally {
    delete stocks.igname;
  }
});

test("annulation : les articles suivis reviennent en stock", async () => {
  await app.request("PATCH", "/api/admin/orders/1", { cookie: adminCookie(), body: { status: "annulee" } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const release = calls.find((c) => c.text.includes("UPDATE products SET stock = stock + $1"));
  assert.deepEqual(release.params, [2, "igname"]);
});

test("clôture de la semaine : aperçu puis exécution (non retirées, ruptures remises à zéro)", async () => {
  assert.equal((await app.request("POST", "/api/admin/orders/close-session")).status, 401);
  const summary = await app.request("GET", "/api/admin/orders/session-summary", { cookie: adminCookie() });
  assert.equal(summary.json.notRetrieved, 2);
  assert.equal(summary.json.unfinished, 1);
  assert.equal(summary.json.soldOutProducts, 3);
  assert.equal(summary.json.today, "2026-11-14");

  const done = await app.request("POST", "/api/admin/orders/close-session", { cookie: adminCookie() });
  assert.equal(done.status, 200);
  assert.deepEqual({ n: done.json.notRetrieved, r: done.json.restocked, c: done.json.compositionsReset }, { n: 2, r: 3, c: 1 });
  const missed = calls.find((c) => c.text.includes("UPDATE orders SET status = 'non_retiree'"));
  assert.deepEqual(missed.params, ["2026-11-14"]);
  const composition = JSON.parse(calls.find((c) => c.text.includes("UPDATE baskets SET composition")).params[0]);
  assert.equal(composition.entries[0].soldOut, false);
});

test("à prévenir : commandes prêtes non notifiées ; marquer prévenu à la main", async () => {
  const list = await app.request("GET", "/api/admin/orders/to-notify", { cookie: adminCookie() });
  assert.equal(list.json.orders[0].order_number, "ABC");
  calls.length = 0;
  const res = await app.request("PATCH", "/api/admin/orders/5", { cookie: adminCookie(), body: { notified: true } });
  assert.equal(res.status, 200);
  const update = calls.find((c) => c.text.includes("UPDATE orders SET"));
  assert.match(update.text, /notified_at/);
  assert.equal(update.params[3], true);
});

test("système : état de la configuration sans secret, sauvegarde en JSON sans mot de passe", async () => {
  assert.equal((await app.request("GET", "/api/admin/system/health")).status, 401);
  const health = await app.request("GET", "/api/admin/system/health", { cookie: adminCookie() });
  assert.equal(health.json.smtp, false);
  assert.equal(health.json.onlinePayment, false);
  assert.equal(health.json.lastBackupAt, "2026-11-01T10:00:00.000Z");
  assert.ok(!JSON.stringify(health.json).includes("SECRET"));

  const test = await app.request("POST", "/api/admin/system/test-email", { cookie: adminCookie() });
  assert.equal(test.status, 502);
  assert.match(test.json.error, /pas configuré/);

  assert.equal((await app.request("GET", "/api/admin/system/backup")).status, 401);
  const backup = await app.request("GET", "/api/admin/system/backup", { cookie: adminCookie() });
  assert.equal(backup.status, 200);
  assert.match(backup.headers.get("content-disposition"), /sauvegarde-heritage-.*\.json/);
  const data = JSON.parse(backup.text);
  assert.ok(Array.isArray(data.orders) && Array.isArray(data.customers));
  assert.ok(!backup.text.includes("password_hash"));
  assert.ok(calls.some((c) => c.text.includes("INSERT INTO site_settings") && c.params[0].includes("at")));
});

test("paiement en ligne : désactivé sans clés, session créée et lien renvoyé quand activé", async () => {
  // Sans clés : le choix « en ligne » retombe sur le paiement au retrait.
  const off = await app.request("POST", "/api/orders", { body: { customer: { ...orderBody.customer, paymentMethod: "en_ligne" }, items: orderBody.items } });
  assert.equal(off.json.paymentUrl, null);
  assert.equal(calls.find((c) => c.text.includes("INSERT INTO orders")).params[14], "retrait");

  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
  const realFetch = paymentsHttp.fetch;
  let stripeCall = null;
  paymentsHttp.fetch = async (url, init) => {
    stripeCall = { url, body: init.body.toString(), auth: init.headers.authorization };
    return { ok: true, status: 200, json: async () => ({ id: "cs_1", url: "https://checkout.stripe.test/pay/cs_1" }) };
  };
  try {
    const site = await app.request("GET", "/api/site");
    assert.equal(site.json.payments.online, true);
    calls.length = 0;
    const on = await app.request("POST", "/api/orders", { body: { customer: { ...orderBody.customer, paymentMethod: "en_ligne" }, items: orderBody.items } });
    assert.equal(on.json.paymentUrl, "https://checkout.stripe.test/pay/cs_1");
    assert.equal(calls.find((c) => c.text.includes("INSERT INTO orders")).params[14], "en_ligne");
    assert.equal(stripeCall.auth, "Bearer sk_test_x");
    assert.match(stripeCall.body, /unit_amount%5D=1000/); // 10,00 € = 1000 centimes
    assert.match(stripeCall.body, /success_url=.*paiement%3Dok/);

    // Échec de Stripe : la commande reste enregistrée, le client paiera au retrait.
    paymentsHttp.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: { message: "boom" } }) });
    const failed = await app.request("POST", "/api/orders", { body: { customer: { ...orderBody.customer, paymentMethod: "en_ligne" }, items: orderBody.items } });
    assert.equal(failed.status, 200);
    assert.equal(failed.json.paymentUrl, null);
    assert.match(failed.json.paymentError, /au retrait/);
  } finally {
    paymentsHttp.fetch = realFetch;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test("webhook Stripe : signature vérifiée, montant contrôlé, commande marquée payée", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  const sign = (body, secret = "whsec_test", t = Math.floor(Date.now() / 1000)) =>
    `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  const event = (amount, ref = "PAYME1") =>
    JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_9", payment_status: "paid", client_reference_id: ref, amount_total: amount } } });
  const send = async (body, signature) => {
    const res = await fetch(`${app.base}/api/payments/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": signature }, body });
    return res.status;
  };
  try {
    assert.equal(await send(event(2000), "t=1,v1=abc"), 400); // mauvaise signature
    assert.equal(await send(event(2000), sign(event(2000), "autre-secret")), 400);
    assert.ok(!calls.some((c) => c.text.includes("UPDATE orders SET paid = true")));

    assert.equal(await send(event(1999), sign(event(1999))), 200); // montant différent : pas marquée payée
    assert.ok(!calls.some((c) => c.text.includes("UPDATE orders SET paid = true")));

    assert.equal(await send(event(2000), sign(event(2000))), 200);
    const paid = calls.find((c) => c.text.includes("UPDATE orders SET paid = true"));
    assert.deepEqual(paid.params, ["cs_9", 11]);

    const old = sign(event(2000), "whsec_test", Math.floor(Date.now() / 1000) - 3600);
    assert.equal(await send(event(2000), old), 400); // signature trop ancienne (rejeu)
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test("paiement : une commande se marque payée sans changer son statut ; rien à modifier -> 400", async () => {
  const res = await app.request("PATCH", "/api/admin/orders/1", { cookie: adminCookie(), body: { paid: true } });
  assert.equal(res.status, 200);
  const update = calls.find((c) => c.text.includes("UPDATE orders SET"));
  assert.deepEqual(update.params, [null, true, "1", false]);
  assert.equal((await app.request("PATCH", "/api/admin/orders/1", { cookie: adminCookie(), body: {} })).status, 400);
  assert.equal((await app.request("PATCH", "/api/admin/orders/1", { cookie: adminCookie(), body: { status: "non_retiree" } })).status, 200);
});

test("rupture : un article en rupture bloque la commande avec une explication", async () => {
  soldOutProducts.add("igname");
  try {
    const res = await app.request("POST", "/api/cart/check", { body: { items: [{ key: "a", type: "product", slug: "igname", qty: 1 }] } });
    assert.equal(res.json.lines.length, 0);
    assert.match(res.json.unavailable[0].reason, /rupture/);
  } finally {
    soldOutProducts.delete("igname");
  }
});

test("panier : duplication hors vente avec un nom unique ; inconnu -> 404", async () => {
  basketCurrentName = "Panier Familial";
  const res = await app.request("POST", "/api/admin/baskets/3/duplicate", { cookie: adminCookie() });
  assert.equal(res.status, 200);
  const insert = calls.find((c) => c.text.includes("INSERT INTO baskets") && c.text.includes("SELECT $1, $2"));
  assert.equal(insert.params[1], "Panier Familial (copie)");
  basketCurrentName = null;
  assert.equal((await app.request("POST", "/api/admin/baskets/3/duplicate", { cookie: adminCookie() })).status, 404);
});

test("rappel : inscription au checkout (avec email) et désinscription par jeton", async () => {
  await app.request("POST", "/api/orders", { body: { customer: { name: "Marie", phone: "0696000000", email: "Marie@Example.com", reminder: true }, items: orderBody.items } });
  const sub = calls.find((c) => c.text.includes("INSERT INTO reminder_subscribers"));
  assert.equal(sub.params[0], "marie@example.com");
  calls.length = 0;
  await app.request("POST", "/api/orders", { body: { customer: { name: "Marie", phone: "0696000000", reminder: true }, items: orderBody.items } });
  assert.ok(!calls.some((c) => c.text.includes("reminder_subscribers")), "pas d'email, pas d'inscription");

  assert.equal((await app.request("POST", "/api/reminders/unsubscribe", { body: { token: "pas-un-jeton" } })).status, 404);
  const ok = await app.request("POST", "/api/reminders/unsubscribe", { body: { token: "a".repeat(32) } });
  assert.equal(ok.status, 200);
});

test("retrait : le code retrouve la commande, avec ou sans tiret", async () => {
  const ok = await app.request("GET", "/api/admin/orders/code/k7m-4qh", { cookie: adminCookie() });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.order.name, "Awa");
  assert.equal((await app.request("GET", "/api/admin/orders/code/ZZZ999", { cookie: adminCookie() })).status, 404);
  assert.equal((await app.request("GET", "/api/admin/orders/code/K7M4QH")).status, 401);
});

test("la recherche admin accepte un code saisi avec un tiret", async () => {
  await app.request("GET", "/api/admin/orders?q=k7m-4qh", { cookie: adminCookie() });
  const list = calls.find((c) => c.text.includes("SELECT * FROM orders"));
  assert.deepEqual(list.params, ["%k7m-4qh%", "%K7M4QH%"]);
});

test("une commande reçoit un code de retrait, retiré au sort à nouveau en cas de doublon", async () => {
  insertFailures = 2;
  const res = await app.request("POST", "/api/orders", {
    body: { customer: { name: "Awa", phone: "0696123456" }, items: [{ type: "product", slug: "igname", qty: 1 }] }
  });
  assert.equal(res.status, 200);
  assert.match(res.json.orderId, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(calls.filter((c) => c.text.includes("INSERT INTO orders")).length, 3);
});

test("modifier un panier : valeurs invalides refusées avant toute écriture", async () => {
  const patch = (body) => app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body });
  for (const body of [{ name: "  " }, { price: 5000 }, { price: "" }, { items: [{ x: 1 }] }, { summary: "x".repeat(501) }]) {
    assert.equal((await patch(body)).status, 400, JSON.stringify(body).slice(0, 40));
  }
  assert.ok(!calls.some((c) => c.text.includes("UPDATE baskets SET")));
});

test("modifier un panier : un nom déjà pris est refusé, un panier vide ne se met pas en vente", async () => {
  basketNameTaken = true;
  const dup = await app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body: { name: "Panier Découverte" } });
  assert.equal(dup.status, 409);
  basketNameTaken = false;
  basketCurrent = { id: 3, items: [] };
  const empty = await app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body: { active: true } });
  assert.equal(empty.status, 400);
  assert.match(empty.json.error, /au moins un article/);
  const withItem = await app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body: { active: true, items: ["Mangues"] } });
  assert.equal(withItem.status, 200);
});

test("modifier un panier : une modification valide est enregistrée nettoyée, un panier inconnu répond 404", async () => {
  const ok = await app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body: { name: "  Panier du mois ", price: "12.456" } });
  assert.equal(ok.status, 200);
  const update = calls.find((c) => c.text.includes("UPDATE baskets SET"));
  assert.equal(update.params[0], "Panier du mois");
  assert.equal(update.params[1], 12.46);
  basketCurrent = null;
  assert.equal((await app.request("PATCH", "/api/admin/baskets/3", { cookie: adminCookie(), body: { price: 5 } })).status, 404);
});

test("panier personnalisable : remplacements et doubles acceptés, prix fixe, contenu enregistré", async () => {
  const order = (selection) =>
    app.request("POST", "/api/orders", {
      body: { customer, items: [{ key: "f1", type: "basket", slug: "panier-familial", qty: 1, selection }] }
    });
  // On remplace 1 poireau par des oignons : total 3, dans la limite.
  const ok = await order([{ name: "Salade", qty: 1 }, { name: "Poireaux", qty: 1 }, { name: "Oignons", qty: 1 }]);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.total, 34);
  const stored = JSON.parse(calls.find((c) => c.text.includes("INSERT INTO orders")).params[8]);
  assert.deepEqual(stored[0].contents, [{ name: "Salade", qty: 1 }, { name: "Poireaux", qty: 1 }, { name: "Oignons", qty: 1 }]);
  assert.equal(stored[0].price, 34);
});

test("panier personnalisable : un ancien choix invalide bloque la commande (409) avec un choix corrigé", async () => {
  const res = await app.request("POST", "/api/orders", {
    body: { customer, items: [{ key: "f1", type: "basket", slug: "panier-familial", qty: 1, selection: [{ name: "Truffe", qty: 1 }, { name: "Salade", qty: 1 }] }] }
  });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, "SELECTION_CHANGED");
  assert.deepEqual(res.json.adjusted[0].selection, [{ name: "Salade", qty: 1 }]);
});

test("panier personnalisable : dépassement du total, du maximum ou article inconnu signalés", async () => {
  // /cart/check relit le panier comme la commande, sans enregistrer ni limiter le débit.
  const check = async (selection) => {
    const res = await app.request("POST", "/api/cart/check", {
      body: { items: [{ key: "f1", type: "basket", slug: "panier-familial", qty: 1, selection }] }
    });
    return res.json;
  };
  const tooMany = await check([{ name: "Salade", qty: 2 }, { name: "Poireaux", qty: 2 }]);
  assert.equal(tooMany.lines.length, 0);
  assert.equal(tooMany.unavailable.length, 0);
  assert.match(tooMany.adjusted[0].reason, /3 articles/);
  assert.match((await check([{ name: "Salade", qty: 3 }])).adjusted[0].reason, /2 maximum/);
  assert.match((await check([{ name: "Truffe", qty: 1 }])).adjusted[0].reason, /ne fait pas partie/);
  assert.match((await check([{ name: "Salade", qty: 0 }])).adjusted[0].reason, /au moins un article/);
  // Le serveur propose un choix corrigé au lieu de jeter la ligne.
  const fix = (await check([{ name: "Salade", qty: 2 }, { name: "Poireaux", qty: 2 }])).adjusted[0];
  assert.equal(fix.key, "f1");
  assert.deepEqual(fix.selection, [{ name: "Salade", qty: 2 }, { name: "Poireaux", qty: 1 }]);
  assert.ok(fix.changes.length > 0);
  // Sans choix précis (ancien panier, WhatsApp) : composition par défaut.
  const byDefault = await check(undefined);
  assert.equal(byDefault.lines.length, 1);
  assert.deepEqual(byDefault.lines[0].contents, [{ name: "Salade", qty: 1 }, { name: "Poireaux", qty: 2 }]);
});
