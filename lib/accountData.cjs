// Données personnelles saisies dans « Mon espace » : adresses enregistrées et favoris.
const { cleanText } = require("./text.cjs");

const MAX_ADDRESSES = 5;
const MAX_FAVORITES = 60;

class AccountDataError extends Error {}

// [{ label, address }] : 5 adresses au plus, chacune avec un nom court (« Maison », « Bureau ») et le texte de l'adresse.
function sanitizeAddresses(input) {
  if (!Array.isArray(input)) throw new AccountDataError("Les adresses sont invalides.");
  if (input.length > MAX_ADDRESSES) throw new AccountDataError(`Vous pouvez enregistrer ${MAX_ADDRESSES} adresses au plus.`);
  const seen = new Set();
  return input.map((entry) => {
    const address = cleanText(entry?.address, 300);
    const label = cleanText(entry?.label, 40) || "Adresse";
    if (!address) throw new AccountDataError("Une adresse est vide : complétez-la ou supprimez-la.");
    const key = address.toLowerCase();
    if (seen.has(key)) throw new AccountDataError("Une même adresse est enregistrée deux fois.");
    seen.add(key);
    return { label, address };
  });
}

// [{ type: "basket" | "product", slug }] : sans doublon, 60 au plus.
function sanitizeFavorites(input) {
  if (!Array.isArray(input)) throw new AccountDataError("Les favoris sont invalides.");
  const seen = new Set();
  const result = [];
  for (const entry of input) {
    const type = entry?.type === "product" ? "product" : entry?.type === "basket" ? "basket" : null;
    const slug = cleanText(entry?.slug, 120);
    if (!type || !slug) continue;
    const key = `${type}:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type, slug });
  }
  if (result.length > MAX_FAVORITES) throw new AccountDataError(`Vous pouvez garder ${MAX_FAVORITES} favoris au plus.`);
  return result;
}

module.exports = { AccountDataError, sanitizeAddresses, sanitizeFavorites, MAX_ADDRESSES, MAX_FAVORITES };
