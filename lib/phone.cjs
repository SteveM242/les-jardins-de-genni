// Normalise un numéro pour comparer deux saisies du même téléphone :
// "0696 12 34 56", "+596 696 12 34 56" et "00596696123456" donnent le même résultat.
function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Indicatif Martinique (596) suivi des 9 chiffres du numéro local sans le 0 initial.
  if (digits.startsWith("596") && digits.length === 12) digits = `0${digits.slice(3)}`;
  return digits;
}

function samePhone(a, b) {
  const x = normalizePhone(a);
  return x.length >= 8 && x === normalizePhone(b);
}

// Numéro au format international sans "+" (ex: 596696123456), prêt pour wa.me ; "" si invalide.
// Un numéro local à 10 chiffres commençant par 0 reçoit l'indicatif de la Martinique (596).
function toInternationalPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) digits = `596${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

module.exports = { normalizePhone, samePhone, toInternationalPhone };
