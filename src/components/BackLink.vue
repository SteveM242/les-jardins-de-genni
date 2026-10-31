<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

function goBack() {
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push("/");
  }
}
</script>

<template>
  <button type="button" class="back-link" @click="goBack">← Retour</button>
</template>

<style scoped>
.back-link {
  display: inline-block;
  margin-bottom: 20px;
  background: none;
  border: 0;
  padding: 0;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
}

.back-link:hover {
  color: var(--green);
}
</style>
