<script setup>
import { computed, ref } from "vue";
import { useSiteContent } from "../stores/siteContent.js";

const content = useSiteContent();

// Un visiteur qui ferme l'annonce ne la revoit pas tant qu'elle ne change pas (dans cet onglet).
const STORAGE_KEY = "genni-announcement-dismissed";
function readDismissed() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
const dismissed = ref(readDismissed());

const text = computed(() => content.state.announcement?.text || "");
const visible = computed(() => text.value !== "" && dismissed.value !== text.value);

function dismiss() {
  dismissed.value = text.value;
  try {
    sessionStorage.setItem(STORAGE_KEY, text.value);
  } catch {
    // sans importance
  }
}
</script>

<template>
  <div v-if="visible" class="announcement" role="region" aria-label="Annonce">
    <p>{{ text }}</p>
    <button type="button" class="close" aria-label="Fermer l'annonce" @click="dismiss">×</button>
  </div>
</template>

<style scoped>
.announcement {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 9px 44px;
  background: var(--sun);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.announcement p {
  margin: 0;
}

.close {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.close:hover {
  background: rgba(0, 0, 0, 0.1);
}
</style>
