import { reactive } from "vue";
import { api } from "../api.js";

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
  state.error = "";
  const [basketsRes, productsRes] = await Promise.all([api("/api/baskets"), api("/api/products")]);
  if (basketsRes.ok && productsRes.ok) {
    state.baskets = basketsRes.data.baskets || [];
    state.products = productsRes.data.products || [];
    state.loaded = true;
  } else {
    state.error = "Impossible de charger le catalogue. Vérifiez votre connexion puis réessayez.";
  }
  state.loading = false;
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
