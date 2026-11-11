const crypto = require("node:crypto");

// Code de commande = code de retrait : court, facile à dicter ou à lire sur un téléphone.
// Pas de 0/O ni de 1/I/L : impossible de les confondre au comptoir.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

function generateOrderCode() {
  let code = "";
  for (let i = 0; i < LENGTH; i += 1) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

// « k7m-4qh », « K7M 4QH » ou « K7M4QH » désignent la même commande.
function normalizeOrderCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

// Affichage : K7M4QH -> K7M-4QH (les anciens numéros de 8 caractères restent tels quels).
function formatOrderCode(code) {
  const clean = normalizeOrderCode(code);
  return clean.length === LENGTH ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

module.exports = { ALPHABET, LENGTH, generateOrderCode, normalizeOrderCode, formatOrderCode };
