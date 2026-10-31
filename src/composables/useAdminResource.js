import { ref } from "vue";
import { api } from "../api.js";
import { useToast } from "../stores/toast.js";

// Logique commune aux écrans admin (articles, paniers, codes promo) :
// chargement, création, mise à jour en ligne, suppression, avec retours d'erreur visibles.
//   endpoint : "/api/admin/products"
//   listKey  : clé de la liste dans la réponse ("products")
//   itemKey  : clé d'un élément dans la réponse ("product")
export function useAdminResource({ endpoint, listKey, itemKey }) {
  const toast = useToast();
  const items = ref([]);
  const loading = ref(true);
  const loadError = ref("");

  async function load() {
    loading.value = true;
    loadError.value = "";
    const res = await api(endpoint);
    if (res.ok) {
      items.value = res.data[listKey] || [];
    } else {
      loadError.value = res.error;
    }
    loading.value = false;
  }

  // Renvoie { ok, error, item } ; l'appelant décide d'afficher l'erreur dans son formulaire.
  async function create(payload, { prepend = false } = {}) {
    const res = await api(endpoint, { method: "POST", body: payload });
    if (!res.ok) return { ok: false, error: res.error };
    const item = res.data[itemKey];
    if (prepend) items.value.unshift(item);
    else items.value.push(item);
    return { ok: true, item };
  }

  async function update(item, patch) {
    const res = await api(`${endpoint}/${item.id}`, { method: "PATCH", body: patch });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    Object.assign(item, res.data[itemKey]);
    return true;
  }

  async function remove(item, confirmMessage) {
    if (confirmMessage && !confirm(confirmMessage)) return false;
    const res = await api(`${endpoint}/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    items.value = items.value.filter((entry) => entry.id !== item.id);
    return true;
  }

  // Après un upload de photo : la réponse contient l'élément mis à jour.
  function applyUploaded(item, data) {
    Object.assign(item, data[itemKey]);
  }

  return { items, loading, loadError, load, create, update, remove, applyUploaded };
}
