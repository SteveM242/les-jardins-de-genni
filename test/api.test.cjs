const test = require("node:test");
const assert = require("node:assert/strict");
const { installFakeDb, startApp } = require("./helpers.cjs");

const calls = [];
let discountRow = null;
let revokedAdmin = false;
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
    return { rows: params[0].filter((slug) => catalog[slug]).map((slug) => catalog[slug]) };
  }
  if (sql.includes("FROM baskets WHERE slug = ANY")) {
    const basket = { slug: "panier-decouverte", name: "Panier Découverte", price: "12.00", items: ["Mangues", "Christophines"] };
    return { rows: params[0].includes("panier-decouverte") ? [basket] : [] };
  }
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
let app;

test.before(async () => {
  app = await startApp();
});
test.after(() => app.close());
test.beforeEach(() => {
  calls.length = 0;
  discountRow = null;
  revokedAdmin = false;
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
  assert.deepEqual(res.json.counts, { nouvelle: 3, confirmee: 0, prete: 0, livree: 2, annulee: 0, all: 5 });
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
