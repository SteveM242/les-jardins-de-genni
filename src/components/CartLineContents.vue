<script setup>
defineProps({
  line: { type: Object, required: true },
  // open : déplié d'office (relecture) ; sinon repliable
  open: { type: Boolean, default: false }
});
</script>

<template>
  <details v-if="line.contents?.length" class="line-contents" :open="open">
    <summary>Voir le contenu ({{ line.contents.length }} article{{ line.contents.length > 1 ? "s" : "" }})</summary>
    <ul>
      <li v-for="(entry, index) in line.contents" :key="entry.slug || index">
        <span v-if="entry.qty">{{ entry.qty }} × </span>{{ entry.name }}<span v-if="entry.unit" class="unit"> ({{ entry.unit }})</span>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.line-contents {
  margin-top: 4px;
  font-size: 13px;
  color: var(--muted);
}

.line-contents summary {
  cursor: pointer;
  font-weight: 600;
}

.line-contents ul {
  margin: 6px 0 0;
  padding-left: 18px;
}

.unit {
  opacity: 0.8;
}
</style>
