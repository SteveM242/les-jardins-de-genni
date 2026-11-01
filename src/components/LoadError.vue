<script setup>
defineProps({ message: { type: String, required: true } });
defineEmits(["retry"]);
</script>

<template>
  <div class="load-error" role="alert">
    <p>{{ message }}</p>
    <button type="button" class="btn ghost" @click="$emit('retry')">Réessayer</button>
  </div>
</template>

<style scoped>
.load-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #f0b9bd;
  background: #fdeced;
  color: #8a1f27;
}

.load-error p {
  margin: 0;
  font-size: 14px;
}

.load-error .btn {
  padding: 8px 14px;
  font-size: 13px;
}
</style>
