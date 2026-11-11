<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useCatalog } from "../stores/catalog.js";
import { useCart } from "../stores/cart.js";
import LoadError from "../components/LoadError.vue";
import FavoriteButton from "../components/FavoriteButton.vue";

const catalog = useCatalog();
const cart = useCart();
onMounted(catalog.load);

const quantities = reactive({});
const added = reactive({});
const search = ref("");
const activeCategory = ref("all");

function qtyFor(slug) {
  if (!quantities[slug]) quantities[slug] = 1;
  return quantities[slug];
}

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
    const category = product.category || "Autres";
    if (activeCategory.value !== "all" && category !== activeCategory.value) return false;
    return !query || normalize(product.name).includes(query);
  });
});

const grouped = computed(() => {
  const byCategory = {};
  for (const product of visibleProducts.value) {
    const category = product.category || "Autres";
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(product);
  }
  return byCategory;
});

// Pas de photo : un emoji par catégorie plutôt qu'un bloc vide.
const CATEGORY_EMOJI = { fruit: "🍍", "légume": "🥦", "herbes & épices": "🌿", autre: "📦" };

function emojiFor(product) {
  return CATEGORY_EMOJI[String(product.category || "").toLowerCase()] || "🌿";
}

function formatPrice(value) {
  return Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function handleAdd(product) {
  const qty = Math.min(Math.max(Math.floor(Number(qtyFor(product.slug))) || 1, 1), 50);
  quantities[product.slug] = qty;
  cart.addItem(product, qty);
  added[product.slug] = true;
  setTimeout(() => {
    added[product.slug] = false;
  }, 1200);
}
</script>

<template>
  <div class="catalog">
    <div class="container">
      <p class="eyebrow">À la carte</p>
      <h1>Les articles à l'unité</h1>
      <p class="intro">
        En plus des paniers tout faits, vous pouvez choisir vos articles un par un, selon vos
        envies et vos quantités. Vous préférez assembler un vrai panier et le nommer ?
        <RouterLink to="/composer">Composez-le ici</RouterLink>.
      </p>

      <p v-if="catalog.state.loading">Chargement du catalogue…</p>
      <LoadError v-else-if="catalog.state.error" :message="catalog.state.error" @retry="catalog.load" />

      <template v-else>
        <div class="catalog-tools">
          <label class="search-field">
            <span class="sr-only">Rechercher un produit</span>
            <input v-model="search" type="search" placeholder="Rechercher un produit (ex: mangue)" />
          </label>
          <div class="category-chips" role="group" aria-label="Filtrer par catégorie">
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

        <p v-if="visibleProducts.length === 0" class="no-result">Aucun produit ne correspond à votre recherche.</p>

      <div v-for="(products, category) in grouped" :key="category" class="category-block">
        <h2>{{ category }}</h2>
        <div class="product-grid">
          <div v-for="product in products" :key="product.slug" class="product-card">
            <div class="product-media">
              <img v-if="product.image" :src="product.image" :alt="product.name" loading="lazy" />
              <span v-else class="product-placeholder" aria-hidden="true">{{ emojiFor(product) }}</span>
            </div>
            <div>
              <h3>{{ product.name }}</h3>
              <p class="product-price">{{ formatPrice(product.price) }} € / {{ product.unit }}</p>
              <p v-if="product.stockLeft && !product.soldOut" class="low-stock">Plus que {{ product.stockLeft }} !</p>
            </div>
            <span class="product-fav"><FavoriteButton type="product" :slug="product.slug" :name="product.name" /></span>
            <p v-if="product.soldOut" class="sold-out-tag">Rupture cette semaine</p>
            <div v-else class="product-actions">
              <input
                type="number"
                min="1"
                max="50"
                :aria-label="`Quantité de ${product.name}`"
                v-model.number="quantities[product.slug]"
                :value="qtyFor(product.slug)"
              />
              <button type="button" class="btn primary" :aria-label="`Ajouter ${product.name} au panier`" @click="handleAdd(product)">
                {{ added[product.slug] ? "Ajouté ✓" : "Ajouter" }}
              </button>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.low-stock {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--clay-dark);
}

.product-card {
  position: relative;
}

.product-fav {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
}

.sold-out-tag {
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f1ece2;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  text-align: center;
}

.catalog {
  padding: 56px 0 80px;
}

h1 {
  font-size: 30px;
  margin: 4px 0 14px;
  max-width: 560px;
}

.intro {
  color: var(--muted);
  max-width: 540px;
  margin: 0 0 40px;
}

.catalog-tools {
  display: grid;
  gap: 14px;
  margin-bottom: 32px;
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

.category-chips {
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

.no-result {
  color: var(--muted);
}

.category-block {
  margin-bottom: 40px;
}

.category-block h2 {
  font-size: 18px;
  text-transform: capitalize;
  margin: 0 0 18px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.product-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
}

.product-card > div:not(.product-media) {
  padding: 0 18px;
}

.product-card .product-actions {
  padding: 0 18px 18px;
}

.product-media {
  height: 100px;
  background: linear-gradient(135deg, var(--brand-tint), var(--cream-deep));
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-placeholder {
  font-size: 44px;
}

.product-card h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.product-price {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.product-actions {
  display: flex;
  gap: 8px;
}

.product-actions input {
  width: 56px;
  padding: 8px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  font: inherit;
}

.product-actions .btn {
  flex: 1;
  justify-content: center;
  padding: 9px 10px;
  font-size: 13px;
}
</style>
