import { reactive, computed, watch } from "vue";

const STORAGE_KEY = "heritage-cart";

// Une ligne du panier :
//   { key, type: "product" | "basket" | "custom", slug, name, price, unit, qty, contents? }
// `custom` = panier composé par le client : `contents` = [{ slug, name, unit, price, qty }].
function keyOf(item) {
  return item.key || `${item.type}:${item.slug}`;
}

function customUnitPrice(contents) {
  return Math.round(contents.reduce((sum, entry) => sum + entry.price * entry.qty, 0) * 100) / 100;
}

function loadInitialItems() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Les paniers enregistrés avant l'introduction des clés n'en ont pas.
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...item, key: keyOf(item) })) : [];
  } catch {
    return [];
  }
}

const state = reactive({
  items: loadInitialItems(),
  discountCode: ""
});

watch(
  () => state.items,
  (items) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Stockage plein ou bloqué (navigation privée) : le panier reste en mémoire.
    }
  },
  { deep: true }
);

function findByKey(key) {
  return state.items.find((item) => keyOf(item) === key);
}

function addItem(sellable, qty = 1) {
  const key = `${sellable.type}:${sellable.slug}`;
  const existing = findByKey(key);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, 50);
  } else {
    state.items.push({
      key,
      type: sellable.type,
      slug: sellable.slug,
      name: sellable.name,
      price: sellable.price,
      unit: sellable.unit || null,
      qty
    });
  }
}

// Ajoute (ou met à jour, si `key` est fourni) un panier composé par le client.
function saveCustomBasket({ key = null, name, contents, qty = 1 }) {
  const cleanContents = contents.filter((entry) => entry.qty > 0).map((entry) => ({ ...entry }));
  const price = customUnitPrice(cleanContents);
  const existing = key ? findByKey(key) : null;
  if (existing) {
    existing.name = name;
    existing.contents = cleanContents;
    existing.price = price;
    return existing.key;
  }
  // randomUUID n'existe que sur https/localhost : repli simple pour les autres contextes.
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const newKey = `custom:${unique}`;
  state.items.push({ key: newKey, type: "custom", slug: null, name, price, unit: null, qty, contents: cleanContents });
  return newKey;
}

// Ajoute (ou met à jour, si `key` est fourni) un panier personnalisable avec le choix du client.
// selection : [{ name, qty }] ; le prix reste celui du panier (le serveur recontrôle le choix).
function saveBasketSelection({ key = null, basket, selection, qty = 1 }) {
  const chosen = selection.filter((entry) => entry.qty > 0).map(({ name, qty: n }) => ({ name, qty: n }));
  const existing = key ? findByKey(key) : null;
  if (existing) {
    existing.selection = chosen;
    existing.contents = chosen;
    existing.qty = qty;
    existing.price = basket.price;
    return existing.key;
  }
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const newKey = `basket:${basket.slug}:${unique}`;
  state.items.push({
    key: newKey,
    type: "basket",
    slug: basket.slug,
    name: basket.name,
    price: basket.price,
    unit: null,
    qty,
    selection: chosen,
    contents: chosen
  });
  return newKey;
}

function removeItem(key) {
  const index = state.items.findIndex((item) => keyOf(item) === key);
  if (index !== -1) state.items.splice(index, 1);
}

function setQty(key, qty) {
  const item = findByKey(key);
  if (!item) return;
  if (qty <= 0) {
    removeItem(key);
    return;
  }
  item.qty = Math.min(qty, 50);
}

function clear() {
  state.items.splice(0, state.items.length);
  state.discountCode = "";
}

function setDiscountCode(code) {
  state.discountCode = code;
}

// Lignes envoyées au serveur : il relit tout en base, `expectedPrice` sert à détecter un changement de prix.
function toPayload() {
  return state.items.map((item) => ({
    key: keyOf(item),
    type: item.type,
    slug: item.slug,
    name: item.name,
    qty: item.qty,
    expectedPrice: item.price,
    selection: item.type === "basket" && item.selection ? item.selection : undefined,
    contents: item.type === "custom" ? item.contents.map(({ slug, name, qty }) => ({ slug, name, qty })) : undefined
  }));
}

// Aligne les prix locaux sur ceux du serveur (après relecture) et retire les lignes indisponibles.
function applyServerCheck({ lines, unavailable }) {
  for (const line of lines) {
    const item = findByKey(line.key);
    if (!item) continue;
    item.price = line.price;
    item.name = line.name;
    if (line.type === "custom") {
      item.contents = item.contents.map((entry) => {
        const fresh = line.contents.find((c) => c.slug === entry.slug);
        return fresh ? { ...entry, price: fresh.price, name: fresh.name } : entry;
      });
    }
  }
  for (const line of unavailable) {
    if (line.key) removeItem(line.key);
  }
}

const totalItems = computed(() => state.items.reduce((sum, item) => sum + item.qty, 0));
const subtotal = computed(() =>
  Math.round(state.items.reduce((sum, item) => sum + item.qty * item.price, 0) * 100) / 100
);

export function useCart() {
  return {
    items: computed(() => state.items),
    discountCode: computed(() => state.discountCode),
    totalItems,
    subtotal,
    addItem,
    saveCustomBasket,
    saveBasketSelection,
    removeItem,
    setQty,
    setDiscountCode,
    getByKey: findByKey,
    toPayload,
    applyServerCheck,
    clear
  };
}
