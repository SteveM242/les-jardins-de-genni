<script setup>

defineProps({
  eyebrow: { type: String, default: "Informations légales" },
  title: { type: String, required: true },
  updated: { type: String, default: "1er novembre 2026" }
});
</script>

<template>
  <div class="legal-page">
    <div class="container narrow">
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="updated">Dernière mise à jour : {{ updated }}</p>
      <div class="legal-body">
        <slot />
      </div>
      <nav class="legal-links" aria-label="Autres informations légales">
        <RouterLink to="/mentions-legales">Mentions légales</RouterLink>
        <RouterLink to="/confidentialite">Confidentialité</RouterLink>
        <RouterLink to="/conditions">Conditions de commande</RouterLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  padding: 56px 0 80px;
}

.container.narrow {
  max-width: 760px;
}

h1 {
  font-size: 30px;
  margin: 4px 0 6px;
}

.updated {
  margin: 0 0 32px;
  font-size: 13px;
  color: var(--muted);
}

.legal-body :deep(h2) {
  font-size: 19px;
  margin: 32px 0 10px;
}

.legal-body :deep(p),
.legal-body :deep(li) {
  line-height: 1.7;
}

.legal-body :deep(ul) {
  padding-left: 22px;
}

.legal-body :deep(a) {
  color: var(--clay-dark);
  font-weight: 600;
}

.legal-body :deep(dl) {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 18px;
  margin: 0;
}

.legal-body :deep(dt) {
  color: var(--muted);
}

.legal-body :deep(dd) {
  margin: 0;
  overflow-wrap: anywhere;
}

.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 48px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
  font-size: 14px;
}

.legal-links a {
  color: var(--muted);
}
</style>
