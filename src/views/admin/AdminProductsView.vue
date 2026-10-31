<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";

const CATEGORIES = ["fruit", "légume", "herbes & épices", "autre"];
const UNITS = ["kg", "pièce", "filet", "barquette", "botte", "sachet", "litre"];

const categoryLabels = {
  fruit: "🍍 Fruit",
  "légume": "🥦 Légume",
  "herbes & épices": "🌿 Herbes & épices",
  autre: "📦 Autre"
};

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const products = ref([]);
const loading = ref(true);
const error = ref("");
const savedId = ref(null);

const newProduct = reactive({ name: "", unit: "kg", price: "", category: "fruit" });

async function loadProducts() {
  loading.value = true;
  const res = await fetch("/api/admin/products");
  if (res.ok) {
    const data = await res.json();
    products.value = data.products || [];
  }
  loading.value = false;
}

async function updateProduct(product, patch) {
  const res = await fetch(`/api/admin/products/${product.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (res.ok) {
    const data = await res.json();
    Object.assign(product, data.product);
    savedId.value = product.id;
    setTimeout(() => {
      if (savedId.value === product.id) savedId.value = null;
    }, 1200);
  }
}

async function removeProduct(product) {
  if (!confirm(`Supprimer "${product.name}" ? Cette action est définitive.`)) return;
  await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
  products.value = products.value.filter((p) => p.id !== product.id);
}

async function addProduct() {
  error.value = "";
  if (!newProduct.name.trim() || !newProduct.price) {
    error.value = "Le nom et le prix sont obligatoires.";
    return;
  }
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...newProduct, slug: slugify(newProduct.name) })
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || "Impossible d'ajouter l'article.";
    return;
  }
  products.value.push(data.product);
  newProduct.name = "";
  newProduct.price = "";
}

const grouped = computed(() => {
  const byCategory = {};
  for (const product of products.value) {
    const category = product.category || "autre";
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(product);
  }
  return byCategory;
});

onMounted(loadProducts);
</script>

<template>
  <AdminNav>
    <h1>Articles à la carte</h1>
    <p class="hint">Ce sont les articles que vos client·e·s peuvent ajouter un par un sur la page « À la carte ».</p>

    <form class="new-product" @submit.prevent="addProduct">
      <h2>Ajouter un article</h2>
      <div class="new-product-grid">
        <label>
          Nom
          <input v-model.trim="newProduct.name" placeholder="ex: Tomate" />
        </label>
        <label>
          Catégorie
          <select v-model="newProduct.category">
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ categoryLabels[c] }}</option>
          </select>
        </label>
        <label>
          Unité
          <select v-model="newProduct.unit">
            <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </label>
        <label>
          Prix (€)
          <input v-model.number="newProduct.price" type="number" step="0.1" min="0" placeholder="0.00" />
        </label>
        <button type="submit" class="btn primary">+ Ajouter l'article</button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </form>

    <p v-if="loading" class="loading-note">Chargement…</p>
    <p v-else-if="products.length === 0" class="loading-note">Aucun article pour le moment.</p>

    <div v-for="category in CATEGORIES.filter((c) => grouped[c]?.length)" :key="category" class="category-block">
      <h2>{{ categoryLabels[category] }}</h2>

      <div class="products-grid">
        <div v-for="product in grouped[category]" :key="product.id" class="product-card" :class="{ saved: savedId === product.id }">
          <input
            class="product-name"
            v-model.trim="product.name"
            @change="updateProduct(product, { name: product.name })"
          />

          <div class="product-row">
            <select v-model="product.category" @change="updateProduct(product, { category: product.category })">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ categoryLabels[c] }}</option>
            </select>
            <select v-model="product.unit" @change="updateProduct(product, { unit: product.unit })">
              <option v-for="u in UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>

          <div class="product-row">
            <label class="price-field">
              <input
                v-model.number="product.price"
                type="number"
                step="0.1"
                min="0"
                @change="updateProduct(product, { price: product.price })"
              />
              <span>€ / {{ product.unit }}</span>
            </label>
          </div>

          <div class="product-footer">
            <label class="active-toggle">
              <input
                type="checkbox"
                :checked="product.active"
                @change="updateProduct(product, { active: $event.target.checked })"
              />
              En vente
            </label>
            <button type="button" class="link-btn" @click="removeProduct(product)">Supprimer</button>
          </div>
        </div>
      </div>
    </div>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  margin: 0 0 24px;
}

.new-product {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 32px;
}

.new-product h2 {
  font-size: 15px;
  margin: 0 0 16px;
}

.new-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  align-items: end;
}

.new-product-grid label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.new-product-grid input,
.new-product-grid select {
  font: inherit;
  padding: 10px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  color: var(--text);
  background: #fff;
}

.new-product-grid .btn {
  padding: 11px 16px;
  white-space: nowrap;
}

.form-error {
  color: #a3372e;
  font-size: 13px;
  margin: 14px 0 0;
}

.loading-note {
  color: var(--muted);
}

.category-block {
  margin-bottom: 32px;
}

.category-block h2 {
  font-size: 16px;
  margin: 0 0 14px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.product-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  gap: 10px;
  transition: box-shadow 150ms ease;
}

.product-card.saved {
  box-shadow: 0 0 0 2px var(--green);
}

.product-name {
  font: inherit;
  font-weight: 700;
  font-size: 15px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  background: transparent;
}

.product-name:hover,
.product-name:focus {
  border-color: var(--line);
  background: var(--cream);
}

.product-row {
  display: flex;
  gap: 8px;
}

.product-row select {
  flex: 1;
  font: inherit;
  font-size: 13px;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--text);
}

.price-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
  width: 100%;
}

.price-field input {
  width: 80px;
  font: inherit;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.active-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.link-btn {
  background: none;
  border: 0;
  color: #a3372e;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
