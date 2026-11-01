<script setup>
import { site, whatsappGeneralLink } from "../data/site.js";
import SocialLinks from "../components/SocialLinks.vue";
</script>

<template>
  <div class="contact-page">
    <div class="container">
      <p class="eyebrow">Contact</p>
      <h1>Une question ? Écrivez à Genni</h1>
      <p class="intro">
        Pour toute question sur les paniers, la disponibilité ou une commande en cours,
        {{ site.whatsappNumber ? "le plus rapide est WhatsApp. Vous pouvez aussi passer par email." : "écrivez-nous." }}
      </p>

      <p v-if="!site.whatsappNumber && !site.email" class="intro">
        Les coordonnées de contact seront bientôt disponibles. En attendant, vous pouvez passer commande directement sur le site.
      </p>

      <div class="contact-grid">
        <a v-if="site.whatsappNumber" :href="whatsappGeneralLink()" target="_blank" rel="noreferrer" class="contact-card whatsapp">
          <h2>WhatsApp</h2>
          <p>Réponse la plus rapide, aux heures d'ouverture.</p>
          <span class="btn whatsapp">Ouvrir WhatsApp</span>
        </a>

        <a v-if="site.email" :href="`mailto:${site.email}`" class="contact-card">
          <h2>Email</h2>
          <p>{{ site.email }}</p>
          <span class="btn ghost">Envoyer un email</span>
        </a>

        <div class="contact-card static">
          <h2>Zone de retrait / livraison</h2>
          <p>{{ site.location }}</p>
          <p v-if="site.hours">{{ site.hours }}</p>
        </div>
      </div>

      <section class="social-block" aria-labelledby="social-title">
        <h2 id="social-title">Suivez Genni</h2>
        <p class="social-intro">Photos du jardin, récoltes de la semaine, coulisses : retrouvez Genni sur ses réseaux.</p>
        <SocialLinks />
      </section>

    </div>
  </div>
</template>

<style scoped>
.contact-page {
  padding: 56px 0 80px;
}

h1 {
  font-size: 30px;
  margin: 4px 0 14px;
  max-width: 560px;
}

.intro {
  color: var(--muted);
  max-width: 540px;
  margin: 0 0 40px;
}

.social-block {
  display: grid;
  gap: 12px;
  margin-top: 40px;
}

.social-block h2 {
  font-size: 20px;
}

.social-intro {
  margin: 0;
  color: var(--muted);
}

/* Aucun réseau renseigné : pas de bloc vide. */
.social-block:not(:has(.social-links)) {
  display: none;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.contact-card {
  display: block;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
  text-decoration: none;
  color: inherit;
}

.contact-card h2 {
  font-family: "Fraunces", Georgia, serif;
  font-size: 18px;
  margin: 0 0 8px;
}

.contact-card p {
  color: var(--muted);
  font-size: 14px;
  margin: 0 0 16px;
}

.contact-card.static {
  background: var(--cream-deep);
}

.note {
  font-size: 13px;
  font-style: italic;
  color: var(--muted);
}
</style>
