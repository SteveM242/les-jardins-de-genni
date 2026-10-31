<script setup>
import { onMounted, ref } from "vue";
import AdminNav from "../../components/admin/AdminNav.vue";

const baskets = ref([]);
const loading = ref(true);

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

onMounted(loadBaskets);
</script>

<template>
  <AdminNav>
    <h1>Paniers</h1>
    <p class="hint">
      Modifiez le nom, le prix, le résumé ou la description. Pour changer les photos ou la liste
      détaillée des articles, contactez votre développeur — cette page couvre les ajustements
      courants.
    </p>

    <p v-if="loading">Chargement…</p>

    <div v-else class="baskets-grid">
      <div v-for="basket in baskets" :key="basket.id" class="basket-card">
        <div class="basket-card-head">
          <img :src="basket.image" :alt="basket.name" />
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
      </div>
    </div>
  </AdminNav>
</template>

<style scoped>
h1 {
  font-size: 24px;
  margin: 0 0 8px;
}

.hint {
  color: var(--muted);
  font-size: 13px;
  max-width: 640px;
  margin: 0 0 24px;
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
  gap: 12px;
}

.basket-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.basket-card-head img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
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
</style>
