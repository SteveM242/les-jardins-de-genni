<script setup>
import BrandLogo from "./BrandLogo.vue";
import { site, whatsappGeneralLink } from "../data/site.js";
import SocialLinks from "./SocialLinks.vue";
</script>

<template>
  <footer class="site-footer madras-stripe">
    <div class="container site-footer-inner">
      <div class="footer-brand">
        <BrandLogo />
        <p>{{ site.tagline }}</p>
      </div>

      <div class="footer-nav">
        <p class="eyebrow">Le site</p>
        <RouterLink to="/composer">Composer mon panier</RouterLink>
        <RouterLink to="/produits">À la carte</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/commande">Mon panier</RouterLink>
      </div>

      <div class="footer-contact">
        <p class="eyebrow">Contact</p>
        <a v-if="site.whatsappNumber" :href="whatsappGeneralLink()" target="_blank" rel="noreferrer">WhatsApp</a>
        <a v-if="site.email" :href="`mailto:${site.email}`">{{ site.email }}</a>
        <span>{{ site.location }}</span>
        <span v-if="site.hours">{{ site.hours }}</span>
        <SocialLinks variant="footer" />
      </div>
    </div>

    <p class="footer-legal">
      <RouterLink to="/mentions-legales">Mentions légales</RouterLink>
      <RouterLink to="/confidentialite">Confidentialité</RouterLink>
      <RouterLink to="/conditions">Conditions de commande</RouterLink>
    </p>

    <p class="footer-copyright">
      © {{ new Date().getFullYear() }} {{ site.brandName }} ·
      <RouterLink to="/admin/connexion" class="pro-link">Espace Genni</RouterLink>
    </p>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  background: var(--green-dark);
  color: #e6f2e8;
  padding: 48px 0 20px;
  margin-top: 60px;
}

.site-footer-inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 32px;
}

.footer-brand :deep(.brand-logo) {
  color: #fff;
}

.footer-brand p {
  margin: 10px 0 0;
  max-width: 320px;
  color: #d3e8d6;
}

.footer-nav,
.footer-contact {
  display: grid;
  gap: 8px;
}

.footer-nav a,
.footer-contact a,
.footer-contact span {
  text-decoration: none;
  color: #e6f2e8;
  font-weight: 600;
}

.footer-nav .eyebrow,
.footer-contact .eyebrow {
  color: #ffd36b;
}

.footer-legal {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 22px;
  margin: 28px 0 0;
  font-size: 13px;
}

.footer-legal a {
  color: #b4cdb9;
  text-decoration: none;
}

.footer-legal a:hover {
  color: #fff;
  text-decoration: underline;
}

.footer-copyright {
  text-align: center;
  margin: 40px 0 0;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  color: #b4cdb9;
  font-size: 13px;
}

.pro-link {
  color: #b4cdb9;
  text-decoration: underline;
}
</style>
