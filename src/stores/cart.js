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
  items: loadInitialItems(),
  discountCode: ""
});

watch(
  () => state.items,
  (items) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },
  { deep: true }
);

function keyOf(item) {
  return `${item.type}:${item.slug}`;
}

function addItem(sellable, qty = 1) {
  const key = keyOf(sellable);
  const existing = state.items.find((item) => keyOf(item) === key);
  if (existing) {
    existing.qty += qty;
  } else {
    state.items.push({
      type: sellable.type,
      slug: sellable.slug,
      name: sellable.name,
      price: sellable.price,
      unit: sellable.unit || null,
      qty
    });
  }
}

function removeItem(type, slug) {
  const index = state.items.findIndex((item) => item.type === type && item.slug === slug);
  if (index !== -1) state.items.splice(index, 1);
}

function setQty(type, slug, qty) {
  const item = state.items.find((item) => item.type === type && item.slug === slug);
  if (!item) return;
  if (qty <= 0) {
    removeItem(type, slug);
    return;
  }
  item.qty = qty;
}

function clear() {
  state.items.splice(0, state.items.length);
  state.discountCode = "";
}

function setDiscountCode(code) {
  state.discountCode = code;
}

const totalItems = computed(() => state.items.reduce((sum, item) => sum + item.qty, 0));
const subtotal = computed(() => state.items.reduce((sum, item) => sum + item.qty * item.price, 0));

export function useCart() {
  return {
    items: computed(() => state.items),
    discountCode: computed(() => state.discountCode),
    totalItems,
    subtotal,
    addItem,
    removeItem,
    setQty,
    setDiscountCode,
    clear
  };
}
