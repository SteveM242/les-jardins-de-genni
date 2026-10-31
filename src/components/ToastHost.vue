<script setup>
import { useToast } from "../stores/toast.js";

const toast = useToast();
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <div
      v-for="item in toast.state.items"
      :key="item.id"
      class="toast"
      :class="item.type"
      :role="item.type === 'error' ? 'alert' : 'status'"
    >
      <span>{{ item.message }}</span>
      <button type="button" class="toast-close" aria-label="Fermer la notification" @click="toast.dismiss(item.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: grid;
  gap: 8px;
  width: min(360px, calc(100% - 32px));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--green-dark);
  color: #fff;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.toast.error {
  background: #8f2f27;
}

.toast-close {
  background: none;
  border: 0;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}
</style>
