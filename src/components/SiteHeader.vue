<script setup>
import BrandLogo from "./BrandLogo.vue";
import { useCart } from "../stores/cart.js";

const cart = useCart();
</script>

<template>
  <header class="site-header">
    <div class="container site-header-inner">
      <BrandLogo />

      <nav>
        <RouterLink to="/#paniers">Nos paniers</RouterLink>
        <RouterLink to="/comment-ca-marche">Comment ça marche</RouterLink>
        <RouterLink to="/a-propos">À propos</RouterLink>
        <RouterLink to="/contact">Contact</RouterLink>
      </nav>

      <RouterLink to="/commande" class="btn primary compact cart-link">
        Panier
        <span v-if="cart.totalItems.value" class="cart-badge">{{ cart.totalItems.value }}</span>
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(250, 246, 238, 0.92);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
}

nav {
  display: flex;
  gap: 24px;
}

nav a {
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}

nav a:hover {
  color: var(--green);
}

.btn.compact {
  padding: 10px 18px;
  font-size: 13px;
}

.cart-link {
  position: relative;
}

.cart-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--clay);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 760px) {
  nav {
    display: none;
  }
}
</style>
