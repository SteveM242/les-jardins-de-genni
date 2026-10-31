<script setup>
import { ref } from "vue";
import { whatsappOrderLink } from "../data/site.js";
import { useCart } from "../stores/cart.js";

const props = defineProps({
  panier: {
    type: Object,
    required: true
  }
});

const cart = useCart();
const added = ref(false);

function handleAdd() {
  cart.addItem(props.panier, 1);
  added.value = true;
  setTimeout(() => {
    added.value = false;
  }, 1500);
}
</script>

<template>
  <article class="panier-card">
    <div class="panier-card-media">
      <img :src="panier.image" :alt="panier.name" loading="lazy" />
      <span class="panier-card-icon" aria-hidden="true">{{ panier.icon }}</span>
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
        <button type="button" class="btn primary" @click="handleAdd">
          {{ added ? "Ajouté ✓" : "Ajouter au panier" }}
        </button>
      </div>
      <a :href="whatsappOrderLink(panier.name)" target="_blank" rel="noreferrer" class="whatsapp-link">
        ou commander directement sur WhatsApp
      </a>
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
  position: relative;
  height: 150px;
  border-bottom: 1px solid var(--line);
  background: var(--cream-deep);
}

.panier-card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.panier-card-icon {
  position: absolute;
  bottom: 10px;
  right: 10px;
  font-size: 22px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
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

.whatsapp-link {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  text-decoration: underline;
}
</style>
