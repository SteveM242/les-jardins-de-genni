import { reactive } from "vue";

const state = reactive({
  baskets: [],
  products: [],
  loaded: false,
  loading: false,
  error: ""
});

async function load() {
  if (state.loaded || state.loading) return;
  state.loading = true;
  try {
    const [basketsRes, productsRes] = await Promise.all([
      fetch("/api/baskets").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json())
    ]);
    state.baskets = basketsRes.baskets || [];
    state.products = productsRes.products || [];
    state.loaded = true;
  } catch {
    state.error = "Impossible de charger le catalogue.";
  } finally {
    state.loading = false;
  }
}

function findBasketBySlug(slug) {
  return state.baskets.find((basket) => basket.slug === slug) || null;
}

function findProductBySlug(slug) {
  return state.products.find((product) => product.slug === slug) || null;
}

export function useCatalog() {
  return { state, load, findBasketBySlug, findProductBySlug };
}
