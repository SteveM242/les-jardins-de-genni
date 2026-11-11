// Paniers personnalisables (à la manière d'un panier « familial » à 16 articles) :
//   - des articles de base, avec une quantité par défaut ;
//   - des articles de remplacement (quantité 0 par défaut) ;
//   - une quantité maximale par article et un nombre total d'articles à ne pas dépasser ;
//   - le prix du panier reste fixe.
const LIMITS = { maxItems: 60, entries: 60, name: 80, note: 120, qty: 20 };

class CompositionError extends Error {}

function fail(message) {
  throw new CompositionError(message);
}

function wholeNumber(value, label, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} : un nombre entier entre ${min} et ${max} est attendu.`);
  return n;
}

// Contrôle la composition saisie dans l'espace pro. Renvoie la composition nettoyée.
function parseComposition(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.entries)) fail("La composition du panier est invalide.");
  if (raw.entries.length > LIMITS.entries) fail(`Une composition contient au plus ${LIMITS.entries} articles.`);

  const seen = new Set();
  const entries = raw.entries.map((entry) => {
    if (!entry || typeof entry !== "object") fail("Un article de la composition est invalide.");
    const name = String(entry.name ?? "").trim();
    if (!name) fail("Chaque article de la composition doit avoir un nom.");
    if (name.length > LIMITS.name) fail(`« ${name.slice(0, 20)}… » est trop long (${LIMITS.name} caractères maximum).`);
    if (seen.has(name.toLowerCase())) fail(`« ${name} » apparaît deux fois dans la composition.`);
    seen.add(name.toLowerCase());

    const kind = entry.kind === "replacement" ? "replacement" : "base";
    const qty = wholeNumber(entry.qty ?? (kind === "base" ? 1 : 0), `Quantité de « ${name} »`, 0, LIMITS.qty);
    const max = wholeNumber(entry.max ?? Math.max(qty, kind === "base" ? 2 : 1), `Maximum de « ${name} »`, 1, LIMITS.qty);
    if (qty > max) fail(`« ${name} » : la quantité par défaut (${qty}) dépasse le maximum (${max}).`);
    const note = String(entry.note ?? "").trim();
    if (note.length > LIMITS.note) fail(`La précision de « ${name} » est trop longue (${LIMITS.note} caractères maximum).`);
    return { name, qty, max, kind, note };
  });

  const baseTotal = entries.reduce((sum, entry) => sum + entry.qty, 0);
  if (baseTotal === 0) fail("Au moins un article du panier doit avoir une quantité par défaut supérieure à 0.");
  const maxItems = wholeNumber(raw.maxItems ?? baseTotal, "Le nombre total d'articles", 1, LIMITS.maxItems);
  if (baseTotal > maxItems) fail(`Les quantités par défaut (${baseTotal}) dépassent le total autorisé (${maxItems}).`);
  return { maxItems, entries };
}

// Sélection par défaut = quantités par défaut de la composition.
function defaultSelection(composition) {
  return composition.entries.filter((entry) => entry.qty > 0).map((entry) => ({ name: entry.name, qty: entry.qty }));
}

// Contrôle le choix d'un client. Renvoie { selection } ou { error } (jamais d'ajustement silencieux).
function resolveSelection(composition, requested) {
  if (!Array.isArray(requested)) return { selection: defaultSelection(composition) };
  const byName = new Map(composition.entries.map((entry) => [entry.name.toLowerCase(), entry]));
  const quantities = new Map();
  for (const choice of requested.slice(0, LIMITS.entries * 2)) {
    const entry = byName.get(String(choice?.name ?? "").trim().toLowerCase());
    if (!entry) return { error: `« ${String(choice?.name ?? "Article").slice(0, 40)} » ne fait pas partie de ce panier.` };
    const qty = Number(choice.qty);
    if (!Number.isInteger(qty) || qty < 0) return { error: `Quantité invalide pour « ${entry.name} ».` };
    if (qty > entry.max) return { error: `« ${entry.name} » : ${entry.max} maximum.` };
    quantities.set(entry.name, (quantities.get(entry.name) || 0) + qty);
  }
  const selection = composition.entries
    .map((entry) => ({ name: entry.name, qty: quantities.get(entry.name) ?? 0 }))
    .filter((choice) => choice.qty > 0);
  for (const choice of selection) {
    const entry = byName.get(choice.name.toLowerCase());
    if (choice.qty > entry.max) return { error: `« ${entry.name} » : ${entry.max} maximum.` };
  }
  const total = selection.reduce((sum, choice) => sum + choice.qty, 0);
  if (total === 0) return { error: "Choisissez au moins un article." };
  if (total > composition.maxItems) return { error: `Le panier ne peut pas dépasser ${composition.maxItems} articles (vous en avez ${total}).` };
  return { selection };
}

module.exports = { LIMITS, CompositionError, parseComposition, defaultSelection, resolveSelection };
