<script setup>
import { site } from "../data/site.js";

defineProps({
  compact: { type: Boolean, default: false }
});
</script>

<template>
  <section class="rhythm" :class="{ compact }" aria-label="Le rythme de la semaine">
    <p class="rhythm-title">Une vente par semaine, sur commande</p>
    <ol class="rhythm-steps">
      <li v-for="(step, index) in site.weeklyCycle" :key="step.day">
        <span class="rhythm-day">{{ step.day }}</span>
        <strong>{{ step.title }}</strong>
        <span v-if="!compact" class="rhythm-text">{{ step.text }}</span>
        <span v-if="index < site.weeklyCycle.length - 1" class="rhythm-arrow" aria-hidden="true">→</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.rhythm {
  background: var(--green-soft);
  border: 1px solid var(--green-tint);
  border-left: 5px solid var(--clay);
  border-radius: 14px;
  padding: 18px 22px;
  margin: 0 0 28px;
}

.rhythm-title {
  margin: 0 0 12px;
  font-family: "Fraunces", Georgia, serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--green-dark);
}

.rhythm-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
}

.rhythm-steps li {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rhythm-day {
  align-self: flex-start;
  background: var(--green);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 10px;
  border-radius: 999px;
  margin-bottom: 4px;
}

.rhythm-text {
  color: var(--muted);
  font-size: 14px;
}

.rhythm-arrow {
  display: none;
}

@media (min-width: 720px) {
  .rhythm-arrow {
    display: block;
    position: absolute;
    right: -12px;
    top: 0;
    color: var(--clay-dark);
    font-weight: 700;
  }
}

.compact {
  padding: 14px 18px;
  margin-bottom: 20px;
}
</style>
