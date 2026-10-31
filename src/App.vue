<script setup>
import { useRoute } from "vue-router";
import SiteHeader from "./components/SiteHeader.vue";
import SiteFooter from "./components/SiteFooter.vue";

const route = useRoute();
</script>

<template>
  <div class="app-shell">
    <SiteHeader v-if="!route.meta.bare" />
    <main>
      <RouterView />
    </main>
    <SiteFooter v-if="!route.meta.bare" />
  </div>
</template>
