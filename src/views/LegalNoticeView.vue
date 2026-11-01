<script setup>
import { computed } from "vue";
import { site } from "../data/site.js";
import { useSiteContent } from "../stores/siteContent.js";
import LegalPage from "../components/LegalPage.vue";

const content = useSiteContent();
const legal = computed(() => content.state.legal);
const hasPublisher = computed(() => Boolean(legal.value.companyName));

// Attribution exigée par les licences Creative Commons des photos d'illustration.
const PHOTO_CREDITS = [
  { subject: "Jardin de Balata, Martinique", author: "Thérèse Gaigé", license: "CC0" },
  { subject: "Bananeraie et canne à sucre, Martinique", author: "Zinneke", license: "CC BY-SA 3.0" },
  { subject: "Panier de fruits et légumes", author: "auteur inconnu", license: "domaine public" },
  { subject: "Mangues entières et coupées", author: "Ivar Leidus", license: "CC BY-SA 4.0" },
  { subject: "Panier de légumes", author: "NellieBly", license: "CC BY-SA 3.0" },
  { subject: "Fruits de la passion", author: "Ivar Leidus", license: "CC BY-SA 4.0" }
];
</script>

<template>
  <LegalPage title="Mentions légales">
    <h2>Éditeur du site</h2>
    <dl v-if="hasPublisher">
      <dt>Exploitation</dt>
      <dd>{{ legal.companyName }}<span v-if="legal.legalForm"> ({{ legal.legalForm }})</span></dd>
      <template v-if="legal.siret">
        <dt>SIRET</dt>
        <dd>{{ legal.siret }}</dd>
      </template>
      <template v-if="legal.address">
        <dt>Adresse</dt>
        <dd>{{ legal.address }}</dd>
      </template>
      <template v-if="legal.publisher">
        <dt>Directeur·rice de la publication</dt>
        <dd>{{ legal.publisher }}</dd>
      </template>
      <template v-if="legal.phone || site.whatsappNumber">
        <dt>Téléphone</dt>
        <dd>{{ legal.phone || `+${site.whatsappNumber}` }}</dd>
      </template>
      <template v-if="site.email">
        <dt>Email</dt>
        <dd><a :href="`mailto:${site.email}`">{{ site.email }}</a></dd>
      </template>
    </dl>
    <p v-else>Les informations sur l'éditeur du site sont en cours de publication.</p>

    <h2>Hébergement</h2>
    <p>
      Le site est hébergé par Railway Corp. (États-Unis) —
      <a href="https://railway.com" target="_blank" rel="noopener noreferrer">railway.com</a>.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      Les textes, l'identité visuelle et les photographies propres à {{ site.brandName }} sont protégés. Toute reproduction sans
      autorisation est interdite.
    </p>

    <h2>Crédits photographiques</h2>
    <p>
      Certaines photographies d'illustration proviennent de Wikimedia Commons et sont utilisées sous licence libre. Elles ont été
      redimensionnées et converties pour le web.
    </p>
    <ul>
      <li v-for="photo in PHOTO_CREDITS" :key="photo.subject">{{ photo.subject }} — {{ photo.author }} ({{ photo.license }})</li>
    </ul>

    <h2>Responsabilité</h2>
    <p>
      Les compositions de paniers varient selon les récoltes ; les photographies sont données à titre d'illustration. Nous nous
      efforçons de maintenir le site exact et disponible, sans pouvoir garantir l'absence d'interruption ou d'erreur.
    </p>

    <template v-if="legal.mediator">
      <h2>Médiation de la consommation</h2>
      <p>En cas de litige, vous pouvez recourir gratuitement au médiateur de la consommation suivant :</p>
      <p class="pre">{{ legal.mediator }}</p>
    </template>
  </LegalPage>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
</style>
