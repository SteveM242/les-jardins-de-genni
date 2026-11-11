<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { site } from "../data/site.js";
import { useSiteContent } from "../stores/siteContent.js";

defineProps({
  compact: { type: Boolean, default: false }
});

// Statut donné par le serveur (heure de la Martinique, bascule manuelle possible) ; à défaut, le rythme habituel.
const content = useSiteContent();
const saleOpen = computed(() => (content.state.sales ? content.state.sales.open : [6, 0, 1].includes(new Date().getDay())));
const manuallyClosed = computed(() => content.state.sales?.mode === "closed");

const root = ref(null);
const visible = ref(false);
let observer = null;

onMounted(() => {
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible.value = true;
        observer.disconnect();
      }
    },
    { threshold: 0.25 }
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <section ref="root" class="rhythm" :class="{ compact, visible }" aria-labelledby="rhythm-title">
    <div class="rhythm-head">
      <div>
        <p class="rhythm-eyebrow">Comment ça se passe chaque semaine</p>
        <h2 id="rhythm-title">Une vente par semaine, sur commande</h2>
        <p v-if="!compact" class="rhythm-lead">
          Rien n'est vendu à l'avance : les produits sont préparés <strong>après la clôture</strong>, en fonction des commandes
          reçues. C'est ce qui garantit des produits frais, sans gaspillage.
        </p>
      </div>
      <p class="rhythm-status" :class="saleOpen ? 'open' : 'closed'" role="status">
        <span class="dot" aria-hidden="true"></span>
        <template v-if="saleOpen">Vente ouverte : commandez jusqu'à lundi soir</template>
        <template v-else-if="manuallyClosed">Vente fermée pour le moment</template>
        <template v-else>Vente fermée : prochaine ouverture samedi</template>
      </p>
    </div>

    <ol class="rhythm-steps">
      <li v-for="(step, index) in site.weeklyCycle" :key="step.day" :style="{ '--i': index }">
        <span class="rhythm-icon" aria-hidden="true">{{ step.icon }}</span>
        <span class="rhythm-day">{{ step.day }}</span>
        <h3>{{ step.title }}</h3>
        <p v-if="!compact">{{ step.text }}</p>
        <span v-if="index < site.weeklyCycle.length - 1" class="rhythm-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rhythm {
  background: linear-gradient(135deg, var(--green-dark) 0%, var(--green) 100%);
  color: #fff;
  border-radius: 22px;
  padding: 30px 32px 34px;
  margin: 0 0 36px;
  box-shadow: 0 14px 34px rgba(19, 80, 43, 0.22);
  position: relative;
  overflow: hidden;
}

.rhythm::after {
  content: "";
  position: absolute;
  right: -70px;
  top: -70px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(242, 169, 0, 0.35), transparent 70%);
  pointer-events: none;
}

.rhythm-head {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 28px;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 26px;
  position: relative;
  z-index: 1;
}

.rhythm-eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sun);
}

.rhythm h2 {
  margin: 0;
  font-family: "Fraunces", Georgia, serif;
  font-size: 28px;
  line-height: 1.2;
  color: #fff;
}

.rhythm-lead {
  margin: 10px 0 0;
  max-width: 560px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.88);
}

.rhythm-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 9px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  background: #fff;
  color: var(--green-dark);
}

.rhythm-status.closed {
  color: var(--clay-dark);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  flex: 0 0 auto;
}

.open .dot {
  background: #2fb85c;
  animation: pulse 1.8s ease-out infinite;
}

.rhythm-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 22px;
  position: relative;
  z-index: 1;
}

.rhythm-steps li {
  position: relative;
  background: #fff;
  color: var(--text);
  border-radius: 16px;
  padding: 22px 22px 24px;
  opacity: 0;
  transform: translateY(22px);
}

.visible .rhythm-steps li {
  animation: rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
  animation-delay: calc(var(--i) * 0.18s);
}

.rhythm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background: var(--green-tint);
  font-size: 28px;
  margin-bottom: 12px;
}

.visible .rhythm-icon {
  animation: bob 3.2s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.4s + 0.8s);
}

.rhythm-day {
  display: block;
  font-size: 22px;
  font-weight: 800;
  font-family: "Fraunces", Georgia, serif;
  color: var(--green-dark);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.rhythm-steps h3 {
  margin: 2px 0 8px;
  font-size: 16px;
  color: var(--clay-dark);
}

.rhythm-steps p {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

.rhythm-arrow {
  display: none;
  position: absolute;
  top: 50%;
  right: -22px;
  width: 22px;
  height: 22px;
  transform: translateY(-50%);
  color: var(--sun);
  z-index: 2;
}

@media (min-width: 780px) {
  .rhythm-arrow {
    display: block;
  }

  .visible .rhythm-arrow {
    animation: nudge 1.6s ease-in-out infinite;
  }
}

.compact {
  padding: 20px 22px 22px;
  margin-bottom: 24px;
}

.compact h2 {
  font-size: 21px;
}

.compact .rhythm-head {
  margin-bottom: 16px;
}

.compact .rhythm-steps li {
  padding: 14px 16px;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  align-items: center;
}

.compact .rhythm-icon {
  grid-row: span 2;
  width: 42px;
  height: 42px;
  font-size: 22px;
  margin: 0;
}

.compact .rhythm-day {
  font-size: 17px;
}

.compact .rhythm-steps h3 {
  margin: 0;
  font-size: 14px;
}

@keyframes rise {
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes nudge {
  0%,
  100% {
    transform: translate(0, -50%);
  }
  50% {
    transform: translate(5px, -50%);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(47, 184, 92, 0.6);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(47, 184, 92, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rhythm-steps li {
    opacity: 1;
    transform: none;
  }

  .visible .rhythm-steps li,
  .visible .rhythm-icon,
  .visible .rhythm-arrow,
  .open .dot {
    animation: none;
  }
}

@media (max-width: 600px) {
  .rhythm {
    padding: 22px 18px 24px;
  }

  .rhythm h2 {
    font-size: 23px;
  }
}
</style>
