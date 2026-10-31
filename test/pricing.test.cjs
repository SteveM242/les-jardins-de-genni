const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DiscountError,
  roundMoney,
  computeSubtotal,
  assertDiscountUsable,
  discountAmountFor,
  computeTotal,
  clampQuantity
} = require("../lib/pricing.cjs");

test("computeSubtotal additionne prix x quantité avec arrondi au centime", () => {
  assert.equal(computeSubtotal([{ price: 1.1, qty: 3 }, { price: 2.5, qty: 2 }]), 8.3);
  assert.equal(computeSubtotal([]), 0);
});

test("roundMoney évite les erreurs de flottants", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test("discountAmountFor : pourcentage et montant fixe plafonné au sous-total", () => {
  assert.equal(discountAmountFor({ type: "percent", value: "10" }, 25), 2.5);
  assert.equal(discountAmountFor({ type: "fixed", value: "5" }, 25), 5);
  assert.equal(discountAmountFor({ type: "fixed", value: "50" }, 25), 25);
});

test("computeTotal ne descend jamais sous zéro", () => {
  assert.equal(computeTotal(20, 5), 15);
  assert.equal(computeTotal(20, 30), 0);
});

test("assertDiscountUsable refuse code absent, expiré ou épuisé", () => {
  assert.throws(() => assertDiscountUsable(undefined), DiscountError);
  assert.throws(
    () => assertDiscountUsable({ expires_at: "2020-01-01T00:00:00Z" }, new Date("2026-01-01")),
    /expiré/
  );
  assert.throws(() => assertDiscountUsable({ max_uses: 3, used_count: 3 }), /limite/);
  assert.doesNotThrow(() => assertDiscountUsable({ max_uses: 3, used_count: 2, expires_at: null }));
  assert.doesNotThrow(() => assertDiscountUsable({ max_uses: null, used_count: 99 }));
});

test("clampQuantity borne entre 1 et 50", () => {
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity("abc"), 1);
  assert.equal(clampQuantity(7), 7);
  assert.equal(clampQuantity(500), 50);
});
