<script setup>
import { computed, ref } from "vue";
import { formatOrderCode } from "../utils/orderCode.js";

const props = defineProps({
  code: { type: String, required: true },
  title: { type: String, default: "Votre code de retrait" },
  compact: { type: Boolean, default: false }
});

const display = computed(() => formatOrderCode(props.code));
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(display.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // presse-papier indisponible : le code reste lisible à l'écran
  }
}
</script>

<template>
  <div class="ticket" :class="{ compact }">
    <p class="ticket-title">{{ title }}</p>
    <p class="ticket-code" aria-label="Code">{{ display }}</p>
    <button type="button" class="ticket-copy" @click="copy">{{ copied ? "✓ Copié" : "Copier le code" }}</button>
  </div>
</template>

<style scoped>
.ticket {
  position: relative;
  display: inline-block;
  min-width: 260px;
  max-width: 100%;
  padding: 18px 28px 20px;
  background: var(--green-soft);
  border: 2px dashed var(--green);
  border-radius: 16px;
  text-align: center;
}

.ticket-title {
  margin: 0 0 6px !important;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--green-dark) !important;
}

.ticket-code {
  margin: 0 0 10px !important;
  font-family: "Fraunces", Georgia, serif;
  font-size: 44px;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.1;
  color: var(--green-dark) !important;
  user-select: all;
}

.ticket-copy {
  border: 0;
  background: var(--green);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 999px;
  cursor: pointer;
}

.ticket-copy:hover {
  background: var(--green-dark);
}

.compact {
  min-width: 0;
  padding: 10px 16px 12px;
  border-width: 1.5px;
}

.compact .ticket-code {
  font-size: 26px;
  margin-bottom: 6px !important;
}
</style>
