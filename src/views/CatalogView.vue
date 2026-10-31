<script setup>
import { computed, onMounted, reactive } from "vue";
import { useCatalog } from "../stores/catalog.js";
import { useCart } from "../stores/cart.js";

const catalog = useCatalog();
const cart = useCart();
onMounted(catalog.load);

const quantities = reactive({});
const added = reactive({});

function qtyFor(slug) {
  if (!quantities[slug]) quantities[slug] = 1;
  return quantities[slug];
}

const grouped = computed(() => {
  const byCategory = {};
  for (const product of catalog.state.products) {
    const category = product.category || "Autres";
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(product);
  }
  return byCategory;
});

function handleAdd(product) {
  cart.addItem(product, qtyFor(product.slug));
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
      <h1>Composez votre propre panier</h1>
      <p class="intro">
        En plus des paniers tout faits, vous pouvez choisir vos articles un par un, selon vos
        envies et vos quantités.
      </p>

      <p v-if="catalog.state.loading">Chargement du catalogue…</p>

      <div v-for="(products, category) in grouped" :key="category" class="category-block">
        <h2>{{ category }}</h2>
        <div class="product-grid">
          <div v-for="product in products" :key="product.slug" class="product-card">
            <div class="product-media">
              <img v-if="product.image" :src="product.image" :alt="product.name" loading="lazy" />
              <span v-else class="product-placeholder" aria-hidden="true">🌿</span>
            </div>
            <div>
              <h3>{{ product.name }}</h3>
              <p class="product-price">{{ product.price }} € / {{ product.unit }}</p>
            </div>
            <div class="product-actions">
              <input
                type="number"
                min="1"
                max="20"
                v-model.number="quantities[product.slug]"
                :value="qtyFor(product.slug)"
              />
              <button type="button" class="btn primary" @click="handleAdd(product)">
                {{ added[product.slug] ? "Ajouté ✓" : "Ajouter" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  background: var(--cream-deep);
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
  font-size: 32px;
  opacity: 0.6;
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
