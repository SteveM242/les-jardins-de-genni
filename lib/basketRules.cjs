const { roundMoney } = require("./pricing.cjs");
const { CompositionError, parseComposition } = require("./composition.cjs");

// Contrôles appliqués à tout panier créé ou modifié depuis l'espace pro.
const LIMITS = {
  name: 120,
  summary: 500,
  details: 2000,
  origin: 300,
  itemName: 80,
  itemCount: 40,
  maxPrice: 1000
};

class BasketInputError extends Error {}

function fail(message) {
  throw new BasketInputError(message);
}

function text(value, label, max) {
  if (typeof value !== "string") fail(`${label} : texte attendu.`);
  const clean = value.trim();
  if (clean.length > max) fail(`${label} est trop long (${max} caractères maximum).`);
  return clean;
}

function parseItems(value) {
  if (!Array.isArray(value)) fail("Le contenu du panier doit être une liste d'articles.");
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    if (typeof entry !== "string" && typeof entry !== "number") fail("Le contenu du panier est invalide.");
    const name = String(entry).trim();
    if (!name) continue;
    if (name.length > LIMITS.itemName) fail(`Un article est trop long (${LIMITS.itemName} caractères maximum) : « ${name.slice(0, 20)}… ».`);
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // doublon ignoré : « Mangues » ajouté deux fois
    seen.add(key);
    items.push(name);
  }
  if (items.length > LIMITS.itemCount) fail(`Un panier contient au plus ${LIMITS.itemCount} articles.`);
  return items;
}

// body : corps de la requête. partial : modification (seuls les champs fournis sont contrôlés).
// Renvoie les champs valides et nettoyés ; lève BasketInputError avec un message lisible sinon.
function parseBasketInput(body, { partial }) {
  const input = body && typeof body === "object" ? body : {};
  const provided = (key) => (partial ? input[key] !== undefined && input[key] !== null : true);
  const out = {};

  if (provided("name")) {
    out.name = text(input.name ?? "", "Le nom", LIMITS.name);
    if (!out.name) fail("Le nom du panier est obligatoire.");
  }
  if (provided("price")) {
    const price = roundMoney(Number(input.price));
    if (input.price === "" || !Number.isFinite(price) || price <= 0) fail("Le prix doit être supérieur à 0.");
    if (price > LIMITS.maxPrice) fail(`Le prix semble trop élevé (maximum ${LIMITS.maxPrice} €). Vérifiez la valeur saisie.`);
    out.price = price;
  }
  for (const [key, label] of [["summary", "Le résumé"], ["details", "La description"], ["origin", "L'origine"]]) {
    if (partial ? provided(key) : input[key] !== undefined && input[key] !== null) {
      out[key] = text(input[key], label, LIMITS[key]);
    }
  }
  if (partial ? provided("items") : input.items !== undefined && input.items !== null) {
    out.items = parseItems(input.items);
  }
  // Panier personnalisable : false = revenir à un panier classique ; objet = nouvelle composition.
  // La liste d'articles affichée (items) est alors déduite de la composition.
  if (partial && input.composition === false) {
    out.clearComposition = true;
  } else if (input.composition !== undefined && input.composition !== null) {
    try {
      out.composition = parseComposition(input.composition);
    } catch (err) {
      if (err instanceof CompositionError) fail(err.message);
      throw err;
    }
    out.items = out.composition.entries.filter((entry) => entry.qty > 0).map((entry) => entry.name);
    out.itemCount = out.composition.entries.reduce((sum, entry) => sum + entry.qty, 0);
  }
  if (provided("active") && (partial || input.active !== undefined)) {
    if (typeof input.active !== "boolean") fail("Valeur « en vente » invalide.");
    out.active = input.active;
  }
  return out;
}

module.exports = { LIMITS, BasketInputError, parseBasketInput };
