<script setup>
import { computed, ref } from "vue";
import { site, whatsappOrderLink } from "../data/site.js";
import { useCart } from "../stores/cart.js";

const props = defineProps({
  panier: {
    type: Object,
    required: true
  }
});

const PREVIEW_COUNT = 4;

const cart = useCart();
const added = ref(false);

// Aperçu du contenu : quelques pastilles puis « +N ».
const preview = computed(() => (props.panier.items || []).slice(0, PREVIEW_COUNT));
const hiddenCount = computed(() => Math.max(0, (props.panier.items || []).length - PREVIEW_COUNT));

function formatPrice(value) {
  return Number(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

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
    <div class="media">
      <img v-if="panier.image" :src="panier.image" :alt="panier.name" loading="lazy" />
      <span v-else class="placeholder" aria-hidden="true">{{ panier.icon || "🧺" }}</span>
      <span class="count-chip">{{ panier.itemCount }} article{{ panier.itemCount > 1 ? "s" : "" }}</span>
    </div>

    <div class="body">
      <h3>
        <!-- Le lien couvre toute la carte (::after) : cliquer n'importe où ouvre le détail. -->
        <RouterLink :to="`/panier/${panier.slug}`" class="card-link">{{ panier.name }}</RouterLink>
      </h3>
      <p class="summary">{{ panier.summary }}</p>

      <ul v-if="preview.length" class="contents" aria-label="Aperçu du contenu">
        <li v-for="item in preview" :key="item">{{ item }}</li>
        <li v-if="hiddenCount" class="more">+{{ hiddenCount }}</li>
      </ul>

      <div class="footer">
        <div class="price-row">
          <p class="price">
            <strong>{{ formatPrice(panier.price) }} €</strong>
            <span>le panier</span>
          </p>
          <a
            v-if="site.whatsappNumber"
            :href="whatsappOrderLink(panier.name)"
            target="_blank"
            rel="noreferrer"
            class="wa-btn"
            :aria-label="`Commander ${panier.name} sur WhatsApp`"
            title="Commander sur WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z" />
            </svg>
          </a>
        </div>
        <div class="actions">
          <button type="button" class="add-btn" :class="{ done: added }" @click="handleAdd">
            <svg v-if="!added" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ added ? "Ajouté" : "Ajouter" }}</span>
          </button>
        </div>
      </div>
      <span class="sr-only" aria-live="polite">{{ added ? `${panier.name} ajouté au panier` : "" }}</span>
    </div>
  </article>
</template>

<style scoped>
.panier-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(60, 35, 20, 0.06), 0 8px 24px rgba(60, 35, 20, 0.08);
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.panier-card:hover,
.panier-card:focus-within {
  transform: translateY(-4px);
  box-shadow: 0 2px 4px rgba(60, 35, 20, 0.08), 0 16px 36px rgba(60, 35, 20, 0.16);
}

.media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--brand-tint);
  overflow: hidden;
}

.media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 500ms ease;
}

.panier-card:hover .media img {
  transform: scale(1.06);
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
}

.count-chip {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  color: var(--brand-dark);
  font-size: 12px;
  font-weight: 700;
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 20px 18px;
}

h3 {
  font-size: 20px;
}

.card-link {
  color: var(--text);
  text-decoration: none;
}

.card-link::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
}

.card-link:focus-visible {
  outline: none;
}

.panier-card:has(.card-link:focus-visible) {
  outline: 3px solid var(--sea-dark);
  outline-offset: 2px;
}

.summary {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.contents {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
}

.contents li {
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-tint);
  color: var(--brand-dark);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contents li.more {
  background: transparent;
  border-style: dashed;
  color: var(--muted);
}

/* Le pied de carte reste toujours en bas : toutes les cartes ont la même allure. */
.footer {
  margin-top: auto;
  padding-top: 14px;
  display: grid;
  gap: 12px;
  border-top: 1px solid var(--line);
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.price {
  display: grid;
  margin: 0;
  line-height: 1.15;
}

.price strong {
  font-family: "Fraunces", Georgia, serif;
  font-size: 24px;
  color: var(--brand-dark);
}

.price span {
  font-size: 12px;
  color: var(--muted);
}

.actions {
  position: relative;
  z-index: 2; /* au-dessus du lien étiré de la carte */
  display: grid;
}

.price-row .wa-btn {
  position: relative;
  z-index: 2;
}

.wa-btn {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #25d366;
  color: #0c3d22;
  transition: transform 150ms ease;
}

.wa-btn:hover {
  transform: scale(1.08);
}

.add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 150ms ease, transform 150ms ease;
}

.add-btn:hover {
  background: var(--brand-dark);
}

.add-btn:active {
  transform: scale(0.97);
}

.add-btn.done {
  background: var(--brand-dark);
}

/* En colonne unique sur mobile, une image 4:3 prendrait presque tout l'écran. */
@media (max-width: 600px) {
  .media {
    aspect-ratio: 16 / 10;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panier-card:hover,
  .panier-card:focus-within {
    transform: none;
  }

  .panier-card:hover .media img {
    transform: none;
  }
}
</style>
