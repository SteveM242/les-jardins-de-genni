const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { metaFor, renderHtml, robotsTxt, sitemapXml } = require("../lib/seo.cjs");
const { installFakeDb, startApp } = require("./helpers.cjs");

installFakeDb(async (text, params = []) => {
  if (text.includes("SELECT slug FROM baskets")) return { rows: [{ slug: "panier-decouverte" }] };
  if (text.includes("FROM baskets WHERE slug = $1")) {
    return params[0] === "panier-decouverte"
      ? {
          rows: [
            {
              slug: "panier-decouverte",
              name: "Panier <Découverte>",
              summary: 'Un "petit" format',
              price: "12.00",
              has_upload: false,
              image: "/images/panier-decouverte.webp",
              items: []
            }
          ]
        }
      : { rows: [] };
  }
  return { rows: [] };
});

const template = `<head>
    <title>Défaut</title>
    <meta name="description" content="défaut" />
    <!--app-meta-->
  </head>`;
const context = { baseUrl: "https://exemple.fr", pathname: "/produits" };

test("metaFor : pages publiques indexables, pages privées en noindex", () => {
  assert.equal(metaFor("/produits").noindex, false);
  assert.match(metaFor("/produits").title, /carte/);
  assert.equal(metaFor("/commande").noindex, true);
  assert.equal(metaFor("/admin/articles").noindex, true);
  assert.equal(metaFor("/n-importe-quoi").noindex, true);
  assert.equal(metaFor("/produits/").noindex, false);
});

test("renderHtml remplace titre et description et injecte Open Graph avec URL absolues", () => {
  const html = renderHtml(template, metaFor("/produits"), context);
  assert.ok(!html.includes("Défaut"));
  assert.ok(!html.includes("<!--app-meta-->"));
  assert.match(html, /<title>Les articles à la carte — L&#39;Héritage des Mornes<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/exemple\.fr\/images\/hero-jardin\.webp"/);
  assert.match(html, /rel="canonical" href="https:\/\/exemple\.fr\/produits"/);
});

test("renderHtml échappe le HTML venant de la base (nom de panier)", () => {
  const html = renderHtml(template, metaFor("/panier/x", { name: 'A <b>"x"</b>', summary: "s", price: 1, image: null }), context);
  assert.ok(!html.includes("<b>"));
  assert.match(html, /A &lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);
});

test("robots.txt et sitemap.xml", () => {
  assert.match(robotsTxt("https://exemple.fr"), /Disallow: \/admin[\s\S]*Sitemap: https:\/\/exemple\.fr\/sitemap\.xml/);
  const xml = sitemapXml("https://exemple.fr", ["panier-decouverte"]);
  assert.match(xml, /<loc>https:\/\/exemple\.fr\/produits<\/loc>/);
  assert.match(xml, /<loc>https:\/\/exemple\.fr\/panier\/panier-decouverte<\/loc>/);
  assert.ok(!xml.includes("/commande"));
  assert.ok(!xml.includes("/compte"));
});

test("le serveur sert robots.txt et sitemap.xml", async () => {
  const app = await startApp();
  try {
    const robots = await app.request("GET", "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(robots.text, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
    const sitemap = await app.request("GET", "/sitemap.xml");
    assert.match(sitemap.text, /panier-decouverte/);
  } finally {
    await app.close();
  }
});

test("la page d'un panier contient ses balises de partage (si dist/ est construit)", { skip: !fs.existsSync(path.join(__dirname, "..", "dist", "index.html")) }, async () => {
  const app = await startApp();
  try {
    const res = await app.request("GET", "/panier/panier-decouverte");
    assert.equal(res.status, 200);
    assert.match(res.text, /og:title" content="Panier &lt;Découverte&gt; — L&#39;Héritage des Mornes"/);
    assert.match(res.text, /og:description" content="Un &quot;petit&quot; format"/);
    const unknown = await app.request("GET", "/panier/inconnu");
    assert.match(unknown.text, /noindex/);
  } finally {
    await app.close();
  }
});
