<script setup>
import BrandLogo from "./BrandLogo.vue";
import { site, whatsappGeneralLink } from "../data/site.js";
</script>

<template>
  <footer class="site-footer">
    <div class="container site-footer-inner">
      <div class="footer-brand">
        <BrandLogo />
        <p>{{ site.tagline }}</p>
      </div>

      <div class="footer-nav">
        <p class="eyebrow">Le site</p>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/commande">Mon panier</RouterLink>
      </div>

      <div class="footer-contact">
        <p class="eyebrow">Contact</p>
        <a :href="whatsappGeneralLink()" target="_blank" rel="noreferrer">WhatsApp</a>
        <a :href="`mailto:${site.email}`">{{ site.email }}</a>
        <span>{{ site.location }}</span>
      </div>
    </div>

    <p class="footer-copyright">© {{ new Date().getFullYear() }} {{ site.brandName }}</p>
  </footer>
</template>

<style scoped>
.site-footer {
  background: var(--green-dark);
  color: #eef3ea;
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
  color: #cfe0d0;
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
  color: #eef3ea;
  font-weight: 600;
}

.footer-nav .eyebrow,
.footer-contact .eyebrow {
  color: #a9d6ad;
}

.footer-copyright {
  text-align: center;
  margin: 40px 0 0;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  color: #a9b8ab;
  font-size: 13px;
}
</style>
