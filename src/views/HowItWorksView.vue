<script setup>
import { RouterLink } from "vue-router";
import { site } from "../data/site.js";
</script>

<template>
  <div class="how-it-works">
    <div class="container">
      <p class="eyebrow">Comment ça marche</p>
      <h1>Commander chez Genni, étape par étape</h1>
      <p class="intro">
        Deux façons de commander : en ligne via le formulaire, ou directement sur WhatsApp si vous
        préférez échanger avec Genni. Dans les deux cas, le principe reste le même.
      </p>

      <ol class="steps-list">
        <li v-for="(step, index) in site.howItWorks" :key="step.title">
          <span class="step-number">{{ index + 1 }}</span>
          <div>
            <h2>{{ step.title }}</h2>
            <p>{{ step.text }}</p>
          </div>
        </li>
      </ol>

      <div class="detail-grid">
        <div class="detail-card">
          <h3>Commande en ligne</h3>
          <p>
            Ajoutez un ou plusieurs paniers depuis la page d'un panier ou directement depuis la liste,
            puis validez votre commande avec vos coordonnées. Genni reçoit votre demande et vous
            recontacte pour confirmer la disponibilité.
          </p>
        </div>
        <div class="detail-card">
          <h3>Commande WhatsApp</h3>
          <p>
            Sur chaque panier, un lien ouvre WhatsApp avec un message déjà rédigé. Il ne reste qu'à
            l'envoyer à Genni pour démarrer la conversation.
          </p>
        </div>
        <div class="detail-card">
          <h3>Retrait ou livraison</h3>
          <p>
            Précisez votre préférence lors de la commande. Genni confirme le jour, l'heure et le lieu
            selon les tournées de la semaine.
          </p>
        </div>
        <div class="detail-card">
          <h3>Paiement</h3>
          <p>
            Le règlement se fait directement avec Genni au moment du retrait ou de la livraison
            (espèces ou virement selon accord).
          </p>
        </div>
      </div>

      <div class="cta">
        <RouterLink to="/#paniers" class="btn primary">Voir les paniers disponibles</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.how-it-works {
  padding: 56px 0 80px;
}

h1 {
  font-size: 32px;
  margin: 4px 0 16px;
  max-width: 600px;
}

.intro {
  color: var(--muted);
  max-width: 580px;
  margin: 0 0 40px;
}

.steps-list {
  list-style: none;
  margin: 0 0 48px;
  padding: 0;
  display: grid;
  gap: 28px;
  max-width: 640px;
}

.steps-list li {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.step-number {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--green);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-family: "Fraunces", Georgia, serif;
}

.steps-list h2 {
  font-size: 17px;
  margin: 0 0 6px;
}

.steps-list p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}

.detail-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 22px;
}

.detail-card h3 {
  font-family: "Fraunces", Georgia, serif;
  font-size: 17px;
  margin: 0 0 10px;
}

.detail-card p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.cta {
  text-align: center;
}
</style>
