<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";

const products = ref([]);
const loading = ref(true);
const newProduct = reactive({ slug: "", name: "", unit: "pièce", price: "", category: "" });
const error = ref("");

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
  }
}

async function removeProduct(product) {
  await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
  products.value = products.value.filter((p) => p.id !== product.id);
}

async function addProduct() {
  error.value = "";
  if (!newProduct.slug || !newProduct.name || !newProduct.price) {
    error.value = "Identifiant, nom et prix sont requis.";
    return;
  }
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newProduct)
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || "Impossible d'ajouter l'article.";
    return;
  }
  products.value.push(data.product);
  newProduct.slug = "";
  newProduct.name = "";
  newProduct.price = "";
  newProduct.category = "";
}

onMounted(loadProducts);
</script>

<template>
  <AdminNav>
    <h1>Articles à la carte</h1>

    <form class="new-product" @submit.prevent="addProduct">
      <input v-model.trim="newProduct.slug" placeholder="identifiant (ex: tomate)" />
      <input v-model.trim="newProduct.name" placeholder="nom affiché" />
      <input v-model.trim="newProduct.unit" placeholder="unité (kg, pièce...)" />
      <input v-model.number="newProduct.price" type="number" step="0.1" placeholder="prix €" />
      <input v-model.trim="newProduct.category" placeholder="catégorie (fruit, légume...)" />
      <button type="submit" class="btn primary">Ajouter</button>
    </form>
    <p v-if="error" class="form-error">{{ error }}</p>

    <p v-if="loading">Chargement…</p>

    <table v-else class="products-table">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Catégorie</th>
          <th>Unité</th>
          <th>Prix</th>
          <th>Actif</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in products" :key="product.id">
          <td>
            <input v-model.trim="product.name" @change="updateProduct(product, { name: product.name })" />
          </td>
          <td>
            <input v-model.trim="product.category" @change="updateProduct(product, { category: product.category })" />
          </td>
          <td>
            <input v-model.trim="product.unit" @change="updateProduct(product, { unit: product.unit })" />
          </td>
          <td>
            <input
              v-model.number="product.price"
              type="number"
              step="0.1"
              @change="updateProduct(product, { price: product.price })"
            />
          </td>
          <td>
            <input
              type="checkbox"
              :checked="product.active"
              @change="updateProduct(product, { active: $event.target.checked })"
            />
          </td>
          <td>
            <button type="button" class="link-btn" @click="removeProduct(product)">Supprimer</button>
          </td>
        </tr>
      </tbody>
    </table>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 24px;
}

.new-product {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
}

.new-product input {
  flex: 1;
  min-width: 120px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  font: inherit;
}

.form-error {
  color: #a3372e;
  font-size: 13px;
  margin: 8px 0 20px;
}

.products-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  margin-top: 20px;
}

.products-table th,
.products-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}

.products-table th {
  background: var(--cream-deep);
  font-size: 12px;
  text-transform: uppercase;
}

.products-table input[type="text"],
.products-table input:not([type="checkbox"]) {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--line);
  font: inherit;
}

.link-btn {
  background: none;
  border: 0;
  color: #a3372e;
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
}
</style>
