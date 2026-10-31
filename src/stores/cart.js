import { reactive, computed, watch } from "vue";

const STORAGE_KEY = "genni-cart";

function loadInitialItems() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const state = reactive({
  items: loadInitialItems()
});

watch(
  () => state.items,
  (items) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },
  { deep: true }
);

function addItem(panier, qty = 1) {
  const existing = state.items.find((item) => item.slug === panier.slug);
  if (existing) {
    existing.qty += qty;
  } else {
    state.items.push({
      slug: panier.slug,
      name: panier.name,
      price: panier.price,
      qty
    });
  }
}

function removeItem(slug) {
  const index = state.items.findIndex((item) => item.slug === slug);
  if (index !== -1) state.items.splice(index, 1);
}

function setQty(slug, qty) {
  const item = state.items.find((item) => item.slug === slug);
  if (!item) return;
  if (qty <= 0) {
    removeItem(slug);
    return;
  }
  item.qty = qty;
}

function clear() {
  state.items.splice(0, state.items.length);
}

const totalItems = computed(() => state.items.reduce((sum, item) => sum + item.qty, 0));
const totalPrice = computed(() => state.items.reduce((sum, item) => sum + item.qty * item.price, 0));

export function useCart() {
  return {
    items: computed(() => state.items),
    totalItems,
    totalPrice,
    addItem,
    removeItem,
    setQty,
    clear
  };
}
