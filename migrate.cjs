const bcrypt = require("bcryptjs");
const { query } = require("./db.cjs");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pièce',
  price NUMERIC(10,2) NOT NULL,
  category TEXT,
  image TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS baskets (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  image TEXT,
  price NUMERIC(10,2) NOT NULL,
  summary TEXT,
  details TEXT,
  origin TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  fulfillment TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  items JSONB NOT NULL,
  discount_code TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const SEED_BASKETS = [
  {
    slug: "panier-peyi-classique",
    name: "Panier Péyi Classique",
    icon: "🧺",
    image: "/images/panier-peyi-classique.jpg",
    price: 20,
    summary: "Le mélange du jardin : légumes et fruits de saison, pour une semaine de cuisine péyi.",
    details:
      "Le panier qui change selon la récolte de la semaine : un équilibre entre légumes à cuire et fruits à croquer, pensé pour les repas de tous les jours. Idéal pour découvrir ou redécouvrir les produits péyi.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier.",
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
    image: "/images/panier-fruits-tropicaux.jpg",
    price: 18,
    summary: "Un concentré de douceur : mangues, ananas, bananes et fruits de la passion.",
    details:
      "Pour les amateurs de fruits bien mûrs et parfumés. La composition varie légèrement selon les arrivages — le corossol n'est disponible que quelques semaines par an.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier.",
    items: ["Mangues", "Ananas", "Bananes jaunes", "Fruits de la passion", "Papaye", "Corossol (selon saison)"]
  },
  {
    slug: "panier-legumes-jardin",
    name: "Panier Légumes Jardin",
    icon: "🥬",
    image: "/images/panier-legumes-jardin.jpg",
    price: 17,
    summary: "Que des légumes : de quoi cuisiner toute la semaine sans repasser par le marché.",
    details:
      "Pensé pour les familles qui cuisinent beaucoup : un panier 100% légumes, sans fruits, pour varier les plats du quotidien.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier.",
    items: [
      "Christophines", "Ignames", "Patates douces", "Giraumon", "Choux péyi",
      "Épinards péyi (brèdes)", "Concombres", "Piments doux"
    ]
  },
  {
    slug: "panier-decouverte",
    name: "Panier Découverte",
    icon: "🌱",
    image: "/images/panier-decouverte.jpg",
    price: 12,
    summary: "Un petit format pour découvrir, seul·e ou en couple.",
    details:
      "La même qualité que les grands paniers, en quantité réduite — idéal pour tester avant de passer à un format plus grand.",
    origin: "Cultivé sur l'exploitation de Genni, récolté le jour de préparation du panier.",
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
  await query(SCHEMA);

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

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const { rows } = await query("SELECT id FROM admins WHERE email = $1", [email]);
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    if (rows.length === 0) {
      await query("INSERT INTO admins (email, password_hash) VALUES ($1,$2)", [email, passwordHash]);
      console.log(`[migrate] Compte admin créé pour ${email}.`);
    } else {
      await query("UPDATE admins SET password_hash = $1 WHERE email = $2", [passwordHash, email]);
    }
  } else {
    console.log("[migrate] ADMIN_EMAIL / ADMIN_PASSWORD non configurés — pas de compte admin créé.");
  }
}

module.exports = { migrate };
