<script setup>
import { site } from "../data/site.js";
</script>

<template>
  <RouterLink to="/" class="brand-logo">
    <span class="brand-mark">
      <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true">
        <circle cx="24" cy="24" r="24" fill="#3c5a3e" />
        <path d="M14 30c0-10 8-16 18-16 1 8-3 16-11 18-4 1-7-1-7-2z" fill="#bf6a3b" />
      </svg>
    </span>
    <span class="brand-text">
      <strong>{{ site.brandName }}</strong>
    </span>
  </RouterLink>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

.brand-mark {
  display: inline-flex;
  flex: 0 0 auto;
}

.brand-text strong {
  font-family: "Fraunces", Georgia, serif;
  font-size: 18px;
  white-space: nowrap;
}
</style>
