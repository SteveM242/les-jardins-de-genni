// Code de commande = code de retrait (voir lib/orderCode.cjs). K7M4QH -> K7M-4QH.
export function normalizeOrderCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

export function formatOrderCode(code) {
  const clean = normalizeOrderCode(code);
  return clean.length === 6 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

// Dernière commande passée sur cet appareil : le code reste retrouvable si l'onglet est fermé.
const LAST_ORDER_KEY = "heritage-last-order";

export function saveLastOrder(order) {
  try {
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ ...order, savedAt: Date.now() }));
  } catch {
    // stockage indisponible : le code reste affiché à l'écran et envoyé par email
  }
}

export function loadLastOrder() {
  try {
    const order = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
    // Un code de plus de 3 semaines ne sert plus au retrait.
    if (order?.code && Date.now() - order.savedAt < 21 * 24 * 3600 * 1000) return order;
  } catch {
    // ignoré
  }
  return null;
}
