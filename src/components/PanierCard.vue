<script setup>
import { whatsappOrderLink } from "../data/site.js";

defineProps({
  panier: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <article class="panier-card">
    <div class="panier-card-media" aria-hidden="true">
      <span>{{ panier.icon }}</span>
    </div>

    <div class="panier-card-body">
      <h3>{{ panier.name }}</h3>
      <p class="panier-card-summary">{{ panier.summary }}</p>

      <div class="panier-card-meta">
        <span>{{ panier.itemCount }} articles</span>
        <strong>Dès {{ panier.price }} €</strong>
      </div>

      <div class="panier-card-actions">
        <RouterLink :to="`/panier/${panier.slug}`" class="btn ghost">Voir le détail</RouterLink>
        <a :href="whatsappOrderLink(panier.name)" target="_blank" rel="noreferrer" class="btn whatsapp">
          Commander
        </a>
      </div>
    </div>
  </article>
</template>

<style scoped>
.panier-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}

.panier-card-media {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--cream-deep);
  background-image: radial-gradient(var(--line) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border-bottom: 1px solid var(--line);
}

.panier-card-media span {
  font-size: 44px;
}

.panier-card-body {
  padding: 22px;
  display: grid;
  gap: 12px;
}

.panier-card-summary {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.panier-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--muted);
}

.panier-card-meta strong {
  color: var(--text);
  font-size: 16px;
}

.panier-card-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.panier-card-actions .btn {
  flex: 1;
  justify-content: center;
  padding: 11px 14px;
  font-size: 13px;
}
</style>
