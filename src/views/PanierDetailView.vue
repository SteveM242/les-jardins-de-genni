<script setup>
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { findPanierBySlug } from "../data/paniers.js";
import { whatsappOrderLink } from "../data/site.js";

const route = useRoute();
const panier = computed(() => findPanierBySlug(route.params.slug));
</script>

<template>
  <div v-if="panier" class="panier-detail">
    <div class="container">
      <RouterLink to="/#paniers" class="back-link">← Tous les paniers</RouterLink>

      <div class="panier-detail-grid">
        <div class="panier-detail-media" aria-hidden="true">
          <span>{{ panier.icon }}</span>
        </div>

        <div class="panier-detail-body">
          <p class="eyebrow">{{ panier.itemCount }} articles</p>
          <h1>{{ panier.name }}</h1>
          <p class="panier-detail-price">{{ panier.price }} €</p>
          <p class="panier-detail-summary">{{ panier.summary }}</p>

          <a :href="whatsappOrderLink(panier.name)" target="_blank" rel="noreferrer" class="btn whatsapp">
            Commander sur WhatsApp
          </a>

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
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--cream-deep);
  background-image: radial-gradient(var(--line) 1.5px, transparent 1.5px);
  background-size: 18px 18px;
  border: 1px solid var(--line);
}

.panier-detail-media span {
  font-size: 88px;
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
