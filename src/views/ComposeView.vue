<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCatalog } from "../stores/catalog.js";
import { useCart } from "../stores/cart.js";
import { useToast } from "../stores/toast.js";
import LoadError from "../components/LoadError.vue";

const DRAFT_KEY = "heritage-compose-draft";
const MAX_PER_ITEM = 50;

const route = useRoute();
const router = useRouter();
const catalog = useCatalog();
const cart = useCart();
const toast = useToast();
onMounted(catalog.load);

// Si ?panier=<clé> est présent, on modifie un panier sur mesure déjà dans le panier.
const editingKey = computed(() => (typeof route.query.panier === "string" ? route.query.panier : null));
const editing = computed(() => (editingKey.value ? cart.getByKey(editingKey.value) : null));

const basketName = ref("Mon panier");
const selection = reactive({}); // slug -> quantité
const search = ref("");
const activeCategory = ref("all");

function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

// Le brouillon survit à un changement de page ou à un rechargement (mais pas à la fermeture de l'onglet).
onMounted(() => {
  if (editing.value) {
    basketName.value = editing.value.name;
    for (const entry of editing.value.contents) selection[entry.slug] = entry.qty;
    return;
  }
  const draft = readDraft();
  if (draft) {
    basketName.value = draft.name || "Mon panier";
    Object.assign(selection, draft.selection || {});
  }
});

watch(
  [basketName, selection],
  () => {
    if (editing.value) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name: basketName.value, selection: { ...selection } }));
    } catch {
      // stockage indisponible : le brouillon reste en mémoire
    }
  },
  { deep: true }
);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const categories = computed(() => [...new Set(catalog.state.products.map((p) => p.category || "Autres"))]);

const visibleProducts = computed(() => {
  const query = normalize(search.value.trim());
  return catalog.state.products.filter((product) => {
    if (activeCategory.value !== "all" && (product.category || "Autres") !== activeCategory.value) return false;
    return !query || normalize(product.name).includes(query);
  });
});

function qtyOf(slug) {
  return selection[slug] || 0;
}

function setQty(slug, value) {
  const qty = Math.min(Math.max(Math.floor(Number(value)) || 0, 0), MAX_PER_ITEM);
  if (qty === 0) delete selection[slug];
  else selection[slug] = qty;
}

const chosen = computed(() =>
  catalog.state.products
    .filter((product) => selection[product.slug])
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      unit: product.unit,
      price: product.price,
      qty: selection[product.slug]
    }))
);

const total = computed(() => Math.round(chosen.value.reduce((sum, entry) => sum + entry.price * entry.qty, 0) * 100) / 100);
const itemCount = computed(() => chosen.value.reduce((sum, entry) => sum + entry.qty, 0));

function formatPrice(value) {
  return Number(value.toFixed(2)).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function validateBasket() {
  if (chosen.value.length === 0) return;
  const name = basketName.value.trim() || "Mon panier";
  cart.saveCustomBasket({ key: editing.value ? editing.value.key : null, name, contents: chosen.value });
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // sans importance
  }
  toast.success(editing.value ? "Panier modifié." : `« ${name} » ajouté à votre panier.`);
  router.push("/commande");
}

function startOver() {
  if (!confirm("Vider la sélection en cours ?")) return;
  for (const slug of Object.keys(selection)) delete selection[slug];
  basketName.value = "Mon panier";
}
</script>

<template>
  <div class="compose">
    <div class="container">
      <p class="eyebrow">Sur mesure</p>
      <h1>{{ editing ? "Modifier mon panier" : "Composez votre panier" }}</h1>
      <p class="intro">
        Choisissez vos fruits et légumes, donnez un nom à votre panier, puis validez-le. L'Héritage des Mornes recevra exactement la liste
        de ce que vous avez choisi.
      </p>

      <p v-if="catalog.state.loading">Chargement des articles…</p>
      <LoadError v-else-if="catalog.state.error" :message="catalog.state.error" @retry="catalog.load" />

      <div v-else class="compose-grid">
        <section aria-label="Articles disponibles">
          <div class="tools">
            <label class="search-field">
              <span class="sr-only">Rechercher un article</span>
              <input v-model="search" type="search" placeholder="Rechercher (ex: mangue)" />
            </label>
            <div class="chips" role="group" aria-label="Filtrer par catégorie">
              <button type="button" class="chip" :class="{ active: activeCategory === 'all' }" :aria-pressed="activeCategory === 'all'" @click="activeCategory = 'all'">
                Tout
              </button>
              <button
                v-for="category in categories"
                :key="category"
                type="button"
                class="chip"
                :class="{ active: activeCategory === category }"
                :aria-pressed="activeCategory === category"
                @click="activeCategory = category"
              >
                {{ category }}
              </button>
            </div>
          </div>

          <p v-if="visibleProducts.length === 0" class="muted">Aucun article ne correspond à votre recherche.</p>

          <ul class="product-list">
            <li v-for="product in visibleProducts" :key="product.slug" class="product-row" :class="{ selected: qtyOf(product.slug) > 0 }">
              <div class="product-info">
                <strong>{{ product.name }}</strong>
                <span class="muted">{{ formatPrice(product.price) }} € / {{ product.unit }}</span>
              </div>
              <span v-if="product.soldOut" class="muted"><strong>Rupture cette semaine</strong></span>
              <div v-else class="qty-stepper">
                <button type="button" :aria-label="`Retirer un ${product.name}`" :disabled="qtyOf(product.slug) === 0" @click="setQty(product.slug, qtyOf(product.slug) - 1)">−</button>
                <input
                  type="number"
                  min="0"
                  :max="MAX_PER_ITEM"
                  :value="qtyOf(product.slug)"
                  :aria-label="`Quantité de ${product.name}`"
                  @change="setQty(product.slug, $event.target.value)"
                />
                <button type="button" :aria-label="`Ajouter un ${product.name}`" @click="setQty(product.slug, qtyOf(product.slug) + 1)">+</button>
              </div>
            </li>
          </ul>
        </section>

        <aside id="resume" class="summary" aria-label="Mon panier sur mesure">
          <h2>Mon panier sur mesure</h2>
          <label class="name-field">
            Nom du panier
            <input v-model="basketName" type="text" maxlength="60" placeholder="ex: Panier du dimanche" />
          </label>

          <p v-if="chosen.length === 0" class="muted">Aucun article choisi pour l'instant.</p>
          <ul v-else class="chosen-list">
            <li v-for="entry in chosen" :key="entry.slug">
              <span>{{ entry.qty }} × {{ entry.name }}</span>
              <span>{{ formatPrice(entry.price * entry.qty) }} €</span>
            </li>
          </ul>

          <div class="summary-total">
            <span>Total ({{ itemCount }} article{{ itemCount > 1 ? "s" : "" }})</span>
            <strong>{{ formatPrice(total) }} €</strong>
          </div>

          <button type="button" class="btn primary" :disabled="chosen.length === 0" @click="validateBasket">
            {{ editing ? "Enregistrer les modifications" : "Valider ce panier" }}
          </button>
          <button v-if="chosen.length > 0 && !editing" type="button" class="link-btn" @click="startOver">Tout effacer</button>
          <p class="note">Vous pourrez encore le relire et le modifier avant d'envoyer votre commande.</p>
        </aside>
      </div>
    </div>

    <div v-if="chosen.length > 0" class="mobile-bar">
      <a href="#resume" class="mobile-bar-link">
        {{ itemCount }} article{{ itemCount > 1 ? "s" : "" }} · {{ formatPrice(total) }} € — Voir mon panier ↓
      </a>
    </div>
  </div>
</template>

<style scoped>
.compose {
  padding: 56px 0 100px;
}

h1 {
  font-size: 30px;
  margin: 4px 0 14px;
}

.intro {
  color: var(--muted);
  max-width: 600px;
  margin: 0 0 32px;
}

.muted {
  color: var(--muted);
  font-size: 13px;
}

.compose-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 32px;
  align-items: start;
}

.tools {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.search-field input {
  width: 100%;
  max-width: 420px;
  font: inherit;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  background: #fff;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
  text-transform: capitalize;
}

.chip.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.product-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border: 1.5px solid var(--line);
  border-radius: 12px;
}

.product-row.selected {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.product-info {
  display: grid;
}

.qty-stepper {
  display: inline-flex;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.qty-stepper button {
  width: 40px;
  height: 40px;
  border: 0;
  background: var(--cream-deep);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--text);
}

.qty-stepper button:disabled {
  opacity: 0.4;
  cursor: default;
}

.qty-stepper input {
  width: 48px;
  height: 40px;
  border: 0;
  text-align: center;
  font: inherit;
  -moz-appearance: textfield;
}

.qty-stepper input::-webkit-outer-spin-button,
.qty-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.summary {
  position: sticky;
  top: 96px;
  display: grid;
  gap: 14px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
}

.summary h2 {
  font-size: 18px;
}

.name-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.name-field input {
  font: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
}

.chosen-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
}

.chosen-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.summary-total {
  display: flex;
  justify-content: space-between;
  font-size: 17px;
}

.summary .btn {
  justify-content: center;
}

.summary .btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.link-btn {
  background: none;
  border: 0;
  color: var(--clay-dark);
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  justify-self: center;
}

.note {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}

.mobile-bar {
  display: none;
}

@media (max-width: 860px) {
  .compose-grid {
    grid-template-columns: 1fr;
  }

  .summary {
    position: static;
  }

  .mobile-bar {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    padding: 12px 16px;
    background: var(--brand-dark);
  }

  .mobile-bar-link {
    display: block;
    text-align: center;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
  }
}
</style>
