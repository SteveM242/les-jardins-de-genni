<script setup>
import { ref } from "vue";

defineProps({
  modelValue: { type: String, default: "" },
  minlength: { type: [String, Number], default: null },
  autocomplete: { type: String, default: "current-password" }
});
defineEmits(["update:modelValue"]);

const visible = ref(false);
</script>

<template>
  <div class="password-field">
    <input
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :minlength="minlength"
      :autocomplete="autocomplete"
      required
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button
      type="button"
      class="toggle-visibility"
      :aria-label="visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
      @click="visible = !visible"
    >
      <svg v-if="visible" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
        <line x1="3" y1="21" x2="21" y2="3" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.password-field {
  position: relative;
  display: flex;
}

.password-field input {
  flex: 1;
  font: inherit;
  padding: 11px 42px 11px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.toggle-visibility {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: 0;
  cursor: pointer;
  padding: 8px;
  line-height: 0;
  color: var(--muted);
  display: flex;
  align-items: center;
}

.toggle-visibility:hover {
  color: var(--text);
}
</style>
