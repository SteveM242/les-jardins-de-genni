import { reactive } from "vue";
import { api } from "../api.js";

// Contenu éditorial géré par Genni : liens réseaux sociaux et photos de la galerie d'accueil.
const state = reactive({
  socials: {},
  gallery: [],
  loaded: false,
  loading: false
});

async function load({ force = false } = {}) {
  if ((state.loaded && !force) || state.loading) return;
  state.loading = true;
  const res = await api("/api/site");
  if (res.ok) {
    state.socials = res.data.socials || {};
    state.gallery = res.data.gallery || [];
    state.loaded = true;
  }
  // En cas d'échec le site reste utilisable : pas de réseaux, galerie par défaut.
  state.loading = false;
}

export function useSiteContent() {
  return { state, load };
}
