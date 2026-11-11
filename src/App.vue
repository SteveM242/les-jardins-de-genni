<script setup>
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import SiteHeader from "./components/SiteHeader.vue";
import SiteFooter from "./components/SiteFooter.vue";
import ToastHost from "./components/ToastHost.vue";
import AnnouncementBar from "./components/AnnouncementBar.vue";
import Breadcrumbs from "./components/Breadcrumbs.vue";
import { useSiteContent } from "./stores/siteContent.js";

const route = useRoute();

// Coordonnées, annonce, réseaux : chargés une fois pour tout le site.
const siteContent = useSiteContent();
onMounted(() => siteContent.load());
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <AnnouncementBar v-if="!route.meta.bare" />
    <SiteHeader v-if="!route.meta.bare" />
    <Breadcrumbs v-if="!route.meta.bare" />
    <main id="contenu" tabindex="-1">
      <RouterView />
    </main>
    <SiteFooter v-if="!route.meta.bare" />
    <ToastHost />
  </div>
</template>
