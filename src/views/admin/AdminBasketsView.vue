<script setup>
import { onMounted, reactive, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";
import ImageUploader from "../../components/admin/ImageUploader.vue";

function handleImageUploaded(basket, data) {
  Object.assign(basket, data.basket);
}

const baskets = ref([]);
const loading = ref(true);
const error = ref("");
const newBasket = reactive({ name: "", price: "", summary: "" });
const newItemDraft = reactive({});

async function loadBaskets() {
  loading.value = true;
  const res = await fetch("/api/admin/baskets");
  if (res.ok) {
    const data = await res.json();
    baskets.value = data.baskets || [];
  }
  loading.value = false;
}

async function updateBasket(basket, patch) {
  const res = await fetch(`/api/admin/baskets/${basket.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (res.ok) {
    const data = await res.json();
    Object.assign(basket, data.basket);
  }
}

async function addBasket() {
  error.value = "";
  if (!newBasket.name.trim() || !newBasket.price) {
    error.value = "Le nom et le prix sont obligatoires.";
    return;
  }
  const res = await fetch("/api/admin/baskets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newBasket)
  });
  const data = await res.json();
  if (!res.ok) {
    error.value = data.error || "Impossible de créer ce panier.";
    return;
  }
  baskets.value.unshift(data.basket);
  newBasket.name = "";
  newBasket.price = "";
  newBasket.summary = "";
}

async function removeBasket(basket) {
  if (!confirm(`Supprimer définitivement "${basket.name}" ?`)) return;
  await fetch(`/api/admin/baskets/${basket.id}`, { method: "DELETE" });
  baskets.value = baskets.value.filter((b) => b.id !== basket.id);
}

function addItem(basket) {
  const text = (newItemDraft[basket.id] || "").trim();
  if (!text) return;
  const items = [...basket.items, text];
  updateBasket(basket, { items });
  newItemDraft[basket.id] = "";
}

function removeItem(basket, index) {
  const items = basket.items.filter((_, i) => i !== index);
  updateBasket(basket, { items });
}

onMounted(loadBaskets);
</script>

<template>
  <AdminNav>
    <h1>Paniers</h1>
    <p class="hint">
      Créez un panier, fixez son prix, ajoutez les articles qu'il contient et une photo. C'est ce
      que vos client·e·s verront et pourront commander.
    </p>

    <form class="new-basket" @submit.prevent="addBasket">
      <h2>Créer un panier</h2>
      <div class="new-basket-grid">
        <label>
          Nom
          <input v-model.trim="newBasket.name" placeholder="ex: Panier du mois" />
        </label>
        <label>
          Prix (€)
          <input v-model.number="newBasket.price" type="number" step="0.5" min="0" placeholder="0.00" />
        </label>
        <label class="summary-field">
          Résumé (une phrase)
          <input v-model.trim="newBasket.summary" placeholder="ex: Un panier de saison, pensé pour..." />
        </label>
        <button type="submit" class="btn primary">+ Créer le panier</button>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </form>

    <p v-if="loading">Chargement…</p>

    <div v-else class="baskets-grid">
      <div v-for="basket in baskets" :key="basket.id" class="basket-card">
        <div class="basket-card-head">
          <ImageUploader
            :image-url="basket.image"
            :upload-url="`/api/admin/baskets/${basket.id}/image`"
            @uploaded="(data) => handleImageUploaded(basket, data)"
          />
          <label class="active-toggle">
            <input
              type="checkbox"
              :checked="basket.active"
              @change="updateBasket(basket, { active: $event.target.checked })"
            />
            En vente
          </label>
        </div>

        <label>
          Nom
          <input v-model.trim="basket.name" @change="updateBasket(basket, { name: basket.name })" />
        </label>

        <label>
          Prix (€)
          <input
            v-model.number="basket.price"
            type="number"
            step="0.5"
            @change="updateBasket(basket, { price: basket.price })"
          />
        </label>

        <label>
          Résumé
          <textarea v-model.trim="basket.summary" rows="2" @change="updateBasket(basket, { summary: basket.summary })"></textarea>
        </label>

        <label>
          Description
          <textarea v-model.trim="basket.details" rows="3" @change="updateBasket(basket, { details: basket.details })"></textarea>
        </label>

        <div class="items-field">
          <span class="items-label">Contenu du panier ({{ basket.items.length }} articles)</span>
          <div class="items-tags">
            <span v-for="(item, index) in basket.items" :key="index" class="item-tag">
              {{ item }}
              <button type="button" @click="removeItem(basket, index)" aria-label="Retirer">×</button>
            </span>
            <span v-if="basket.items.length === 0" class="items-empty">Aucun article listé</span>
          </div>
          <div class="item-add-row">
            <input
              v-model="newItemDraft[basket.id]"
              placeholder="ex: Mangues"
              @keyup.enter="addItem(basket)"
            />
            <button type="button" class="btn ghost" @click="addItem(basket)">Ajouter</button>
          </div>
        </div>

        <div class="basket-footer">
          <button type="button" class="link-btn" @click="removeBasket(basket)">Supprimer ce panier</button>
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
  max-width: 640px;
  margin: 0 0 24px;
}

.new-basket {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 32px;
}

.new-basket h2 {
  font-size: 15px;
  margin: 0 0 16px;
}

.new-basket-grid {
  display: grid;
  grid-template-columns: 1fr 140px 2fr auto;
  gap: 14px;
  align-items: end;
}

.new-basket-grid label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.new-basket-grid input {
  font: inherit;
  padding: 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
}

.new-basket-grid .btn {
  padding: 11px 16px;
  white-space: nowrap;
}

.form-error {
  color: #a3372e;
  font-size: 13px;
  margin: 14px 0 0;
}

.baskets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.basket-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.basket-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.active-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.basket-card label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.basket-card input,
.basket-card textarea {
  font: inherit;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.items-field {
  display: grid;
  gap: 8px;
}

.items-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.items-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.item-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--cream-deep);
  border-radius: 999px;
  padding: 4px 6px 4px 10px;
  font-size: 12px;
}

.item-tag button {
  background: none;
  border: 0;
  cursor: pointer;
  color: var(--muted);
  font-size: 14px;
  line-height: 1;
  padding: 2px;
}

.item-tag button:hover {
  color: #a3372e;
}

.items-empty {
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
}

.item-add-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.item-add-row input {
  flex: 1;
  min-width: 0;
}

.item-add-row .btn {
  flex-shrink: 0;
}

.item-add-row .btn {
  padding: 8px 12px;
  font-size: 12px;
  white-space: nowrap;
}

.basket-footer {
  padding-top: 8px;
  border-top: 1px solid var(--line);
  text-align: right;
}

.link-btn {
  background: none;
  border: 0;
  color: #a3372e;
  text-decoration: underline;
  cursor: pointer;
  font-size: 12px;
}

@media (max-width: 640px) {
  .new-basket-grid {
    grid-template-columns: 1fr;
  }
}
</style>
