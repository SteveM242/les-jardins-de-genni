<script setup>
import { useRoute } from "vue-router";
import SiteHeader from "./components/SiteHeader.vue";
import SiteFooter from "./components/SiteFooter.vue";
import ToastHost from "./components/ToastHost.vue";

const route = useRoute();
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <SiteHeader v-if="!route.meta.bare" />
    <main id="contenu" tabindex="-1">
      <RouterView />
    </main>
    <SiteFooter v-if="!route.meta.bare" />
    <ToastHost />
  </div>
</template>
