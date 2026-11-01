<script setup>
import { site } from "../data/site.js";
import LegalPage from "../components/LegalPage.vue";
</script>

<template>
  <LegalPage title="Politique de confidentialité">
    <p>
      {{ site.brandName }} respecte votre vie privée. Cette page explique quelles données personnelles sont collectées quand vous
      commandez ou créez un compte, pourquoi, et comment exercer vos droits.
    </p>

    <h2>Données collectées</h2>
    <ul>
      <li>
        <strong>Quand vous commandez :</strong> nom, téléphone, email (facultatif), adresse (pour une livraison), remarques,
        contenu de la commande et jour souhaité.
      </li>
      <li>
        <strong>Quand vous créez un compte :</strong> nom, email, téléphone et adresse (facultatifs) et un mot de passe, conservé
        uniquement sous forme chiffrée (jamais en clair).
      </li>
    </ul>
    <p>Nous ne collectons aucune donnée de paiement : le règlement se fait à la remise de la commande.</p>

    <h2>Pourquoi ces données ?</h2>
    <ul>
      <li>Préparer, confirmer et remettre votre commande, et vous contacter à son sujet (base légale : exécution du contrat).</li>
      <li>Vous permettre de retrouver et suivre vos commandes dans votre compte.</li>
      <li>Envoyer des messages liés à votre commande ou à votre compte (confirmation, suivi, mot de passe oublié). Pas de publicité.</li>
      <li>Sécuriser le site et prévenir les abus, par exemple en limitant le nombre de tentatives de connexion.</li>
    </ul>

    <h2>Qui y a accès ?</h2>
    <p>
      Uniquement {{ site.brandName }} pour traiter les commandes, et nos prestataires techniques : l'hébergeur (Railway, États-Unis,
      avec des garanties de transfert adaptées) et, le cas échéant, le service d'envoi d'emails. Vos données ne sont ni vendues ni
      cédées à des fins commerciales.
    </p>

    <h2>Combien de temps ?</h2>
    <ul>
      <li>Commandes : le temps nécessaire à leur traitement, puis conservées pour les obligations comptables et légales.</li>
      <li>Compte client : jusqu'à votre demande de suppression.</li>
    </ul>

    <h2>Cookies et stockage local</h2>
    <p>
      Le site n'utilise que ce qui est indispensable à son fonctionnement : un cookie de connexion (si vous avez un compte) et le
      contenu de votre panier, enregistré dans votre navigateur. Aucun cookie publicitaire ni de mesure d'audience n'est déposé :
      aucun bandeau de consentement n'est donc nécessaire.
    </p>

    <h2>Réseaux sociaux</h2>
    <p>
      Les liens vers Instagram, TikTok, Snapchat, Facebook ou YouTube ouvrent ces plateformes, qui appliquent leur propre politique
      de confidentialité. Aucune donnée ne leur est transmise tant que vous ne cliquez pas.
    </p>

    <h2>Vos droits</h2>
    <p>
      Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation ou l'opposition à leur
      traitement, ainsi que leur portabilité. Pour cela, écrivez-nous
      <template v-if="site.email">à <a :href="`mailto:${site.email}`">{{ site.email }}</a></template>
      <template v-else>via la <RouterLink to="/contact">page Contact</RouterLink></template>.
      Vous pouvez aussi introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
    </p>
  </LegalPage>
</template>
