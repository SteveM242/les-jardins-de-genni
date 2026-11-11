// Résolution d'un panier demandé par le client en lignes de commande fiables :
// prix et noms relus en base, contenu des paniers figé dans la ligne (snapshot),
// articles indisponibles signalés au lieu d'être ignorés.
const { roundMoney, clampQuantity } = require("./pricing.cjs");
const { cleanText } = require("./text.cjs");
const { resolveSelection } = require("./composition.cjs");

const MAX_LINES = 50;
const MAX_CUSTOM_CONTENTS = 40;
const CUSTOM_BASKET_NAME = "Panier sur mesure";

function toContents(items) {
  // Les paniers du catalogue listent leur contenu en texte libre (["Mangues", ...]).
  return (Array.isArray(items) ? items : []).map((name) => ({ name: String(name) }));
}

// requested : [{ key?, type: "product"|"basket"|"custom", slug?, qty, name?, contents?: [{ slug, qty }] }]
// db : { query } (le module db.cjs, ou un double de test)
// Renvoie { lines, unavailable } :
//   lines       : lignes valides, avec prix unitaire courant et contenu
//   unavailable : [{ key, name, reason }] lignes impossibles à honorer
async function resolveLines(requested, db) {
  const input = (Array.isArray(requested) ? requested : []).slice(0, MAX_LINES).filter((line) => line && typeof line === "object");

  const productSlugs = new Set();
  const basketSlugs = new Set();
  for (const line of input) {
    if (line.type === "product" && line.slug) productSlugs.add(String(line.slug));
    else if (line.type === "basket" && line.slug) basketSlugs.add(String(line.slug));
    else if (line.type === "custom" && Array.isArray(line.contents)) {
      for (const entry of line.contents.slice(0, MAX_CUSTOM_CONTENTS)) {
        if (entry?.slug) productSlugs.add(String(entry.slug));
      }
    }
  }

  const [{ rows: productRows }, { rows: basketRows }] = await Promise.all([
    productSlugs.size
      ? db.query("SELECT slug, name, unit, price FROM products WHERE slug = ANY($1) AND active = true", [[...productSlugs]])
      : { rows: [] },
    basketSlugs.size
      ? db.query("SELECT slug, name, price, items, composition FROM baskets WHERE slug = ANY($1) AND active = true", [[...basketSlugs]])
      : { rows: [] }
  ]);
  const products = new Map(productRows.map((row) => [row.slug, row]));
  const baskets = new Map(basketRows.map((row) => [row.slug, row]));

  const lines = [];
  const unavailable = [];

  for (const line of input) {
    const key = line.key ? String(line.key) : null;
    const qty = clampQuantity(line.qty);

    if (line.type === "product") {
      const product = products.get(String(line.slug));
      if (!product) {
        unavailable.push({ key, name: cleanText(line.name, 120) || String(line.slug || "Article"), reason: "Cet article n'est plus disponible." });
        continue;
      }
      lines.push({ key, type: "product", slug: product.slug, name: product.name, unit: product.unit, price: Number(product.price), qty });
    } else if (line.type === "basket") {
      const basket = baskets.get(String(line.slug));
      if (!basket) {
        unavailable.push({ key, name: cleanText(line.name, 120) || String(line.slug || "Panier"), reason: "Ce panier n'est plus disponible." });
        continue;
      }
      let contents = toContents(basket.items);
      if (basket.composition) {
        // Panier personnalisable : le choix du client est contrôlé (articles connus, maximums, total) ; prix fixe.
        const { selection, error } = resolveSelection(basket.composition, line.selection);
        if (error) {
          unavailable.push({ key, name: basket.name, reason: error });
          continue;
        }
        contents = selection;
      }
      lines.push({
        key,
        type: "basket",
        slug: basket.slug,
        name: basket.name,
        price: Number(basket.price),
        qty,
        contents
      });
    } else if (line.type === "custom") {
      const name = cleanText(line.name, 60) || CUSTOM_BASKET_NAME;
      const requestedContents = (Array.isArray(line.contents) ? line.contents : []).slice(0, MAX_CUSTOM_CONTENTS);
      const contents = [];
      const missing = [];
      for (const entry of requestedContents) {
        const product = products.get(String(entry?.slug));
        if (!product) {
          missing.push(cleanText(entry?.name, 80) || String(entry?.slug || "Article"));
          continue;
        }
        contents.push({ slug: product.slug, name: product.name, unit: product.unit, price: Number(product.price), qty: clampQuantity(entry.qty) });
      }
      if (missing.length > 0) {
        unavailable.push({ key, name, reason: `Article(s) indisponible(s) : ${missing.join(", ")}.` });
        continue;
      }
      if (contents.length === 0) {
        unavailable.push({ key, name, reason: "Ce panier sur mesure est vide." });
        continue;
      }
      const unitPrice = roundMoney(contents.reduce((sum, entry) => sum + entry.price * entry.qty, 0));
      lines.push({ key, type: "custom", slug: null, name, price: unitPrice, qty, contents });
    } else {
      unavailable.push({ key, name: cleanText(line.name, 120) || "Article", reason: "Article inconnu." });
    }
  }

  return { lines, unavailable };
}

// Compare les prix unitaires que le client avait en tête (expectedPrice) aux prix actuels.
function findPriceChanges(requested, lines) {
  const byKey = new Map(lines.filter((line) => line.key).map((line) => [line.key, line]));
  const changes = [];
  for (const line of Array.isArray(requested) ? requested : []) {
    const current = line?.key ? byKey.get(String(line.key)) : null;
    const expected = Number(line?.expectedPrice);
    if (current && Number.isFinite(expected) && roundMoney(expected) !== roundMoney(current.price)) {
      changes.push({ key: current.key, name: current.name, previousPrice: roundMoney(expected), price: current.price });
    }
  }
  return changes;
}

module.exports = { resolveLines, findPriceChanges, MAX_LINES, MAX_CUSTOM_CONTENTS, CUSTOM_BASKET_NAME };
