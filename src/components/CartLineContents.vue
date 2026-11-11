<script setup>
import { computed, onMounted } from "vue";
import { useCatalog } from "../stores/catalog.js";

const props = defineProps({
  line: { type: Object, required: true },
  // open : déplié d'office (relecture) ; sinon repliable
  open: { type: Boolean, default: false }
});

// Un panier ajouté depuis le catalogue ne porte pas son contenu : on le relit dans le catalogue.
const catalog = useCatalog();
onMounted(catalog.load);
const entries = computed(() => {
  if (props.line.contents?.length) return props.line.contents;
  if (props.line.type !== "basket") return [];
  const basket = catalog.findBasketBySlug?.(props.line.slug);
  return (basket?.items || []).map((name) => ({ name }));
});
</script>

<template>
  <details v-if="entries.length" class="line-contents" :open="open">
    <summary>Voir le contenu ({{ entries.length }} article{{ entries.length > 1 ? "s" : "" }})</summary>
    <ul>
      <li v-for="(entry, index) in entries" :key="entry.slug || index">
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
