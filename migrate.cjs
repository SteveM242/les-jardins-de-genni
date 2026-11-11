const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { pool, query } = require("./db.cjs");
const { ensureAdmin } = require("./lib/adminBootstrap.cjs");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
// Verrou applicatif Postgres : évite que deux instances migrent en même temps.
const MIGRATION_LOCK_ID = 727001;

function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({ id: file.replace(/\.sql$/, ""), sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8") }));
}

// Applique, dans l'ordre, les fichiers de migrations/ pas encore enregistrés dans schema_migrations.
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    );
    const { rows } = await client.query("SELECT id FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.id));

    for (const migration of listMigrations()) {
      if (applied.has(migration.id)) continue;
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
        await client.query("COMMIT");
        console.log(`[migrate] migration appliquée : ${migration.id}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

const SEED_BASKETS = [
  {
    slug: "panier-peyi-classique",
    name: "Panier Péyi Classique",
    icon: "🧺",
    image: "/images/panier-peyi-classique.webp",
    price: 20,
    summary: "Le mélange du jardin : légumes et fruits de saison, pour une semaine de cuisine péyi.",
    details:
      "Le panier qui change selon la récolte de la semaine : un équilibre entre légumes à cuire et fruits à croquer, pensé pour les repas de tous les jours. Idéal pour découvrir ou redécouvrir les produits péyi.",
    origin: "Cultivé sur l'exploitation de la Fée des Mornes, récolté le jour de préparation du panier.",
    items: [
      "Christophines", "Ignames", "Bananes jaunes", "Bananes vertes (à cuire)", "Mangues",
      "Citrons verts", "Giraumon (citrouille péyi)", "Gombos", "Fruits de la passion",
      "Herbes fraîches (thym, persil péyi)"
    ]
  },
  {
    slug: "panier-fruits-tropicaux",
    name: "Panier Fruits Tropicaux",
    icon: "🥭",
    image: "/images/panier-fruits-tropicaux.webp",
    price: 18,
    summary: "Un concentré de douceur : mangues, ananas, bananes et fruits de la passion.",
    details:
      "Pour les amateurs de fruits bien mûrs et parfumés. La composition varie légèrement selon les arrivages — le corossol n'est disponible que quelques semaines par an.",
    origin: "Cultivé sur l'exploitation de la Fée des Mornes, récolté le jour de préparation du panier.",
    items: ["Mangues", "Ananas", "Bananes jaunes", "Fruits de la passion", "Papaye", "Corossol (selon saison)"]
  },
  {
    slug: "panier-legumes-jardin",
    name: "Panier Légumes Jardin",
    icon: "🥬",
    image: "/images/panier-legumes-jardin.webp",
    price: 17,
    summary: "Que des légumes : de quoi cuisiner toute la semaine sans repasser par le marché.",
    details:
      "Pensé pour les familles qui cuisinent beaucoup : un panier 100% légumes, sans fruits, pour varier les plats du quotidien.",
    origin: "Cultivé sur l'exploitation de la Fée des Mornes, récolté le jour de préparation du panier.",
    items: [
      "Christophines", "Ignames", "Patates douces", "Giraumon", "Choux péyi",
      "Épinards péyi (brèdes)", "Concombres", "Piments doux"
    ]
  },
  {
    slug: "panier-decouverte",
    name: "Panier Découverte",
    icon: "🌱",
    image: "/images/panier-decouverte.webp",
    price: 12,
    summary: "Un petit format pour découvrir, seul·e ou en couple.",
    details:
      "La même qualité que les grands paniers, en quantité réduite — idéal pour tester avant de passer à un format plus grand.",
    origin: "Cultivé sur l'exploitation de la Fée des Mornes, récolté le jour de préparation du panier.",
    items: ["Christophines", "Bananes jaunes", "Mangues", "Citrons verts", "Fruits de la passion", "Herbes fraîches"]
  }
];

const SEED_PRODUCTS = [
  { slug: "christophine", name: "Christophine", unit: "pièce", price: 1.2, category: "légume" },
  { slug: "igname", name: "Igname", unit: "kg", price: 3.5, category: "légume" },
  { slug: "banane-jaune", name: "Bananes jaunes", unit: "kg", price: 2.5, category: "fruit" },
  { slug: "banane-verte", name: "Bananes vertes (à cuire)", unit: "kg", price: 2.2, category: "légume" },
  { slug: "mangue", name: "Mangues", unit: "kg", price: 3, category: "fruit" },
  { slug: "citron-vert", name: "Citrons verts", unit: "filet", price: 2, category: "fruit" },
  { slug: "giraumon", name: "Giraumon (citrouille péyi)", unit: "kg", price: 2.8, category: "légume" },
  { slug: "gombo", name: "Gombos", unit: "barquette", price: 2.5, category: "légume" },
  { slug: "fruit-passion", name: "Fruits de la passion", unit: "filet", price: 3.5, category: "fruit" },
  { slug: "ananas", name: "Ananas", unit: "pièce", price: 3.5, category: "fruit" },
  { slug: "patate-douce", name: "Patates douces", unit: "kg", price: 2.8, category: "légume" },
  { slug: "concombre", name: "Concombres", unit: "pièce", price: 1, category: "légume" }
];

async function migrate() {
  await runMigrations();

  const { rows: basketCount } = await query("SELECT COUNT(*)::int AS n FROM baskets");
  if (basketCount[0].n === 0) {
    for (const basket of SEED_BASKETS) {
      await query(
        `INSERT INTO baskets (slug, name, icon, image, price, summary, details, origin, item_count, items)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          basket.slug, basket.name, basket.icon, basket.image, basket.price,
          basket.summary, basket.details, basket.origin, basket.items.length,
          JSON.stringify(basket.items)
        ]
      );
    }
    console.log(`[migrate] ${SEED_BASKETS.length} paniers de démo insérés.`);
  }

  const { rows: productCount } = await query("SELECT COUNT(*)::int AS n FROM products");
  if (productCount[0].n === 0) {
    for (const product of SEED_PRODUCTS) {
      await query(
        `INSERT INTO products (slug, name, unit, price, category) VALUES ($1,$2,$3,$4,$5)`,
        [product.slug, product.name, product.unit, product.price, product.category]
      );
    }
    console.log(`[migrate] ${SEED_PRODUCTS.length} articles de démo insérés.`);
  }

  // Une erreur ici (ex: email déjà pris) ne doit pas empêcher le site de démarrer.
  try {
    await ensureAdmin({ query, hashPassword: (password) => bcrypt.hash(password, 10), env: process.env });
  } catch (err) {
    console.error("[migrate] amorçage du compte admin impossible :", err.message);
  }
}

module.exports = { migrate };
