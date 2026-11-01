<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { setPageTitle } from "../pageMeta.js";
import { useToast } from "../stores/toast.js";
import { useRoute, RouterLink, useRouter } from "vue-router";
import { useCatalog } from "../stores/catalog.js";
import { whatsappOrderLink } from "../data/site.js";
import { useCart } from "../stores/cart.js";
import LoadError from "../components/LoadError.vue";

const route = useRoute();
const router = useRouter();
const catalog = useCatalog();
onMounted(catalog.load);
const panier = computed(() => catalog.findBasketBySlug(route.params.slug));
watch(panier, (basket) => setPageTitle(basket ? basket.name : "Panier introuvable"), { immediate: true });
const cart = useCart();
const toast = useToast();
const qty = ref(1);

// goToCart=false : on reste sur la page pour continuer ses achats.
function handleAdd(goToCart) {
  const quantity = Math.min(Math.max(Math.floor(Number(qty.value)) || 1, 1), 50);
  cart.addItem(panier.value, quantity);
  if (goToCart) router.push("/commande");
  else toast.success(`${quantity} × ${panier.value.name} ajouté${quantity > 1 ? "s" : ""} au panier.`);
}
</script>

<template>
  <div v-if="panier" class="panier-detail">
    <div class="container">
      <RouterLink to="/#paniers" class="back-link">← Tous les paniers</RouterLink>

      <div class="panier-detail-grid">
        <div class="panier-detail-media">
          <img v-if="panier.image" :src="panier.image" :alt="panier.name" />
          <span v-else class="panier-detail-placeholder" aria-hidden="true">{{ panier.icon || "🧺" }}</span>
          <span v-if="panier.image" class="panier-detail-icon" aria-hidden="true">{{ panier.icon }}</span>
        </div>

        <div class="panier-detail-body">
          <p class="eyebrow">{{ panier.itemCount }} articles</p>
          <h1>{{ panier.name }}</h1>
          <p class="panier-detail-price">{{ panier.price }} €</p>
          <p class="panier-detail-summary">{{ panier.summary }}</p>

          <div class="order-box">
            <label class="qty-field">
              Quantité
              <input type="number" min="1" max="50" v-model.number="qty" />
            </label>
            <button type="button" class="btn primary" @click="handleAdd(true)">
              Commander ce panier
            </button>
            <button type="button" class="btn ghost" @click="handleAdd(false)">
              Ajouter et continuer mes achats
            </button>
            <a :href="whatsappOrderLink(panier.name)" target="_blank" rel="noreferrer" class="btn whatsapp">
              Commander sur WhatsApp
            </a>
          </div>

          <div class="panier-detail-section">
            <h2>Ce que contient ce panier</h2>
            <ul class="items-list">
              <li v-for="item in panier.items" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="panier-detail-section">
            <h2>Description</h2>
            <p>{{ panier.details }}</p>
          </div>

          <div class="panier-detail-section">
            <h2>Origine</h2>
            <p>{{ panier.origin }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="catalog.state.loading" class="panier-not-found">
    <div class="container">
      <p>Chargement…</p>
    </div>
  </div>

  <div v-else-if="catalog.state.error" class="panier-not-found">
    <div class="container">
      <LoadError :message="catalog.state.error" @retry="catalog.load" />
    </div>
  </div>

  <div v-else class="panier-not-found">
    <div class="container">
      <h1>Panier introuvable</h1>
      <p>Ce panier n'existe pas ou n'est plus disponible.</p>
      <RouterLink to="/" class="btn primary">Retour à l'accueil</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.panier-detail {
  padding: 48px 0 80px;
}

.back-link {
  display: inline-block;
  margin-bottom: 28px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--muted);
}

.back-link:hover {
  color: var(--green);
}

.panier-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 48px;
  align-items: start;
}

.panier-detail-media {
  position: sticky;
  top: 100px;
  height: 320px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--cream-deep);
}

.panier-detail-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.panier-detail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72px;
  opacity: 0.5;
}

.panier-detail-icon {
  position: absolute;
  margin: 14px;
  font-size: 28px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.qty-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}

.qty-field input {
  width: 70px;
  padding: 10px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  font: inherit;
}

.panier-detail-body h1 {
  font-size: 32px;
  margin: 4px 0 12px;
}

.panier-detail-price {
  font-size: 22px;
  font-weight: 700;
  color: var(--green-dark);
  margin: 0 0 16px;
}

.panier-detail-summary {
  color: var(--muted);
  margin: 0 0 24px;
}

.panier-detail-section {
  margin-top: 36px;
}

.panier-detail-section h2 {
  font-size: 18px;
  margin: 0 0 12px;
}

.panier-detail-section p {
  color: var(--muted);
  margin: 0;
}

.items-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.items-list li {
  padding: 10px 14px;
  background: var(--cream-deep);
  border-radius: 10px;
  font-size: 14px;
}

.panier-not-found {
  padding: 100px 0;
  text-align: center;
}

.panier-not-found p {
  color: var(--muted);
  margin: 12px 0 28px;
}

@media (max-width: 760px) {
  .panier-detail-grid {
    grid-template-columns: 1fr;
  }

  .panier-detail-media {
    position: static;
    height: 220px;
  }

  .items-list {
    grid-template-columns: 1fr;
  }
}
</style>
