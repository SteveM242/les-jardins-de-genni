<script setup>
import { computed } from "vue";
import { site } from "../data/site.js";
import { useSiteContent } from "../stores/siteContent.js";
import LegalPage from "../components/LegalPage.vue";

const content = useSiteContent();
const checkout = computed(() => content.state.checkout);
const mediator = computed(() => content.state.legal.mediator);
</script>

<template>
  <LegalPage eyebrow="Commander" title="Conditions de commande">
    <h2>1. Objet</h2>
    <p>
      Ces conditions régissent les commandes de fruits, légumes et paniers passées sur ce site auprès de {{ site.brandName }}.
      Passer commande implique de les avoir lues et acceptées.
    </p>

    <h2>2. Produits</h2>
    <p>
      Les produits sont cultivés et récoltés selon les saisons. La composition d'un panier peut légèrement varier selon la
      récolte de la semaine ; les photographies sont données à titre d'illustration. Les produits sont frais : ils sont préparés
      pour votre commande.
    </p>

    <h2>3. Prix</h2>
    <p>
      Les prix sont indiqués en euros. Le montant à régler est celui affiché à l'étape de relecture, avant votre confirmation,
      après application éventuelle d'un code promo.
    </p>

    <h2>4. Commande</h2>
    <p>
      Votre commande est une demande : elle est définitivement confirmée lorsque {{ site.brandName }} vous la confirme, selon la
      disponibilité des produits. Si un article n'est plus disponible, vous en êtes informé·e avant de valider ou, à défaut,
      par {{ site.brandName }}.
    </p>

    <h2>5. Paiement</h2>
    <p>Le paiement s'effectue à la remise de la commande, selon les moyens de paiement acceptés par {{ site.brandName }}.</p>

    <h2>6. Retrait et livraison</h2>
    <p v-if="checkout.pickupInfo || checkout.deliveryInfo" class="pre">
      <template v-if="checkout.pickupInfo"><strong>Retrait :</strong> {{ checkout.pickupInfo }}{{ "\n" }}</template>
      <template v-if="checkout.deliveryInfo"><strong>Livraison :</strong> {{ checkout.deliveryInfo }}</template>
    </p>
    <p>
      Les ventes fonctionnent par session hebdomadaire : ouverture le samedi, clôture le lundi soir, retrait des commandes le
      mercredi. Le jour et le lieu de retrait ou de livraison sont confirmés par {{ site.brandName }}. Le jour souhaité indiqué lors de la
      commande est une préférence, non un engagement.
    </p>

    <h2>7. Annulation</h2>
    <p>
      Vous pouvez demander l'annulation de votre commande tant qu'elle n'est pas en préparation, en contactant
      {{ site.brandName }} (voir la <RouterLink to="/contact">page Contact</RouterLink>).
    </p>

    <h2>8. Droit de rétractation</h2>
    <p>
      Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas à la fourniture de
      biens susceptibles de se détériorer ou de se périmer rapidement, ce qui est le cas des fruits et légumes frais.
    </p>

    <h2>9. Réclamations</h2>
    <p>
      Un problème avec votre commande ? Contactez-nous rapidement pour que nous trouvions une solution.
      <template v-if="mediator"> Vous pouvez aussi recourir gratuitement au médiateur de la consommation indiqué dans les <RouterLink to="/mentions-legales">mentions légales</RouterLink>.</template>
    </p>

    <h2>10. Données personnelles et droit applicable</h2>
    <p>
      Vos données sont traitées comme décrit dans la <RouterLink to="/confidentialite">politique de confidentialité</RouterLink>.
      Ces conditions sont soumises au droit français.
    </p>
  </LegalPage>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
</style>
