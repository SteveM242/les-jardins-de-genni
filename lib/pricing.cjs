// Calculs de prix : toute la logique d'argent côté serveur vit ici pour être testable.

// Erreur dont le message peut être montré tel quel au client.
class DiscountError extends Error {}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function computeSubtotal(items) {
  return roundMoney(items.reduce((sum, item) => sum + item.price * item.qty, 0));
}

// Lève une Error au message affichable si le code ne peut pas être utilisé.
function assertDiscountUsable(discount, now = new Date()) {
  if (!discount) throw new DiscountError("Code promo invalide.");
  if (discount.expires_at && new Date(discount.expires_at) < now) {
    throw new DiscountError("Ce code promo a expiré.");
  }
  if (discount.max_uses != null && discount.used_count >= discount.max_uses) {
    throw new DiscountError("Ce code promo a atteint sa limite d'utilisation.");
  }
}

function discountAmountFor(discount, subtotal) {
  if (discount.type === "percent") {
    return roundMoney(subtotal * (Number(discount.value) / 100));
  }
  return Math.min(Number(discount.value), subtotal);
}

function computeTotal(subtotal, discountAmount) {
  return Math.max(0, roundMoney(subtotal - discountAmount));
}

function clampQuantity(value) {
  return Math.min(Math.max(Number(value) || 0, 1), 50);
}

module.exports = {
  DiscountError,
  roundMoney,
  computeSubtotal,
  assertDiscountUsable,
  discountAmountFor,
  computeTotal,
  clampQuantity
};
