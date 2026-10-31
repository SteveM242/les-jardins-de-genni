function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Texte saisi par un utilisateur : chaîne, sans espaces superflus, tronquée.
function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

// Échappe les jokers LIKE pour une recherche "contient" littérale.
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

module.exports = { slugify, cleanText, escapeLike };
