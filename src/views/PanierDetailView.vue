<script setup>
import { computed, reactive, ref, onMounted, watch } from "vue";
import { setPageTitle } from "../pageMeta.js";
import { useToast } from "../stores/toast.js";
import { useRoute, RouterLink, useRouter } from "vue-router";
import { useCatalog } from "../stores/catalog.js";
import { site, whatsappOrderLink, whatsappBasketLink } from "../data/site.js";
import { useCart } from "../stores/cart.js";
import LoadError from "../components/LoadError.vue";
import PanierCard from "../components/PanierCard.vue";
import { srcsetFor } from "../utils/images.js";

const route = useRoute();
const router = useRouter();
const catalog = useCatalog();
onMounted(catalog.load);
const panier = computed(() => catalog.findBasketBySlug(route.params.slug));
watch(panier, (basket) => setPageTitle(basket ? basket.name : "Panier introuvable"), { immediate: true });
// Autres paniers à découvrir en bas de page.
const others = computed(() => catalog.state.baskets.filter((basket) => basket.slug !== route.params.slug).slice(0, 3));
const cart = useCart();
const toast = useToast();
const qty = ref(1);

// ---------- Panier personnalisable : remplacer / doubler des articles, à prix fixe ----------
const composition = computed(() => panier.value?.composition || null);
const choice = reactive({});
// Ligne du panier d'achat en cours de modification (lien « Modifier le contenu »).
const editingKey = computed(() => (typeof route.query.ligne === "string" ? route.query.ligne : null));

function resetChoice() {
  for (const key of Object.keys(choice)) delete choice[key];
  // Un article en rupture cette semaine démarre à 0 : le client choisit un remplacement.
  for (const entry of composition.value?.entries || []) choice[entry.name] = entry.soldOut ? 0 : entry.qty;
}

// Initialise (ou réinitialise) le choix quand le panier est chargé ou qu'on arrive depuis le panier d'achat.
watch(
  [composition, editingKey],
  () => {
    if (!composition.value) return;
    resetChoice();
    const line = editingKey.value ? cart.getByKey(editingKey.value) : null;
    if (line?.selection && line.slug === panier.value.slug) {
      for (const entry of composition.value.entries) choice[entry.name] = 0;
      for (const picked of line.selection) if (picked.name in choice) choice[picked.name] = picked.qty;
      for (const entry of composition.value.entries) if (entry.soldOut) choice[entry.name] = 0;
      qty.value = line.qty;
    }
  },
  { immediate: true }
);

const baseEntries = computed(() => (composition.value?.entries || []).filter((entry) => entry.kind === "base"));
const replacementEntries = computed(() => (composition.value?.entries || []).filter((entry) => entry.kind === "replacement"));
const total = computed(() => Object.values(choice).reduce((sum, n) => sum + n, 0));
const remaining = computed(() => (composition.value ? composition.value.maxItems - total.value : 0));
const isDefault = computed(() => (composition.value?.entries || []).every((entry) => choice[entry.name] === (entry.soldOut ? 0 : entry.qty)));
const selection = computed(() =>
  (composition.value?.entries || []).filter((entry) => choice[entry.name] > 0).map((entry) => ({ name: entry.name, qty: choice[entry.name] }))
);

function canAdd(entry) {
  return !entry.soldOut && choice[entry.name] < entry.max && remaining.value > 0;
}

function bump(entry, delta) {
  const next = choice[entry.name] + delta;
  if (next < 0 || next > entry.max || (delta > 0 && remaining.value <= 0)) return;
  choice[entry.name] = next;
}

// Remplacement en un geste : la quantité de l'article passe sur un autre, dans la limite de son maximum.
function swapTargets(entry) {
  if (!composition.value || !(choice[entry.name] > 0)) return [];
  return composition.value.entries.filter((other) => other.name !== entry.name && !other.soldOut && choice[other.name] < other.max);
}

function swapWith(entry, event) {
  const target = composition.value.entries.find((other) => other.name === event.target.value);
  event.target.value = "";
  if (!target) return;
  const moved = Math.min(choice[entry.name], target.max - choice[target.name]);
  if (moved <= 0) return;
  choice[entry.name] -= moved;
  choice[target.name] += moved;
  toast.success(`${moved} × ${entry.name} remplacé${moved > 1 ? "s" : ""} par ${target.name}.`);
}

// Saisie directe : jamais au-delà du maximum de l'article ni du total autorisé.
function setFromInput(entry, event) {
  const wanted = Math.floor(Number(event.target.value));
  const others = total.value - choice[entry.name];
  const allowed = entry.soldOut ? 0 : Math.min(entry.max, composition.value.maxItems - others);
  const next = Number.isFinite(wanted) ? Math.min(Math.max(wanted, 0), allowed) : choice[entry.name];
  choice[entry.name] = next;
  event.target.value = next;
  if (Number.isFinite(wanted) && wanted > allowed) {
    toast.error(
      allowed === entry.max
        ? `« ${entry.name} » : ${entry.max} maximum.`
        : `Le panier ne peut pas dépasser ${composition.value.maxItems} articles.`
    );
  }
}

const whatsappLink = computed(() =>
  composition.value ? whatsappBasketLink(panier.value.name, selection.value) : whatsappOrderLink(panier.value?.name)
);

// goToCart=false : on reste sur la page pour continuer ses achats.
function handleAdd(goToCart) {
  const quantity = Math.min(Math.max(Math.floor(Number(qty.value)) || 1, 1), 50);
  if (composition.value) {
    if (total.value === 0) {
      toast.error("Choisissez au moins un article.");
      return;
    }
    if (composition.value.requireFull && remaining.value > 0) {
      toast.error(`Ce panier doit contenir exactement ${composition.value.maxItems} articles : il vous en reste ${remaining.value} à choisir.`);
      return;
    }
    cart.saveBasketSelection({ key: editingKey.value, basket: panier.value, selection: selection.value, qty: quantity });
    if (editingKey.value) {
      router.push("/commande");
      return;
    }
  } else {
    cart.addItem(panier.value, quantity);
  }
  if (goToCart) router.push("/commande");
  else toast.success(`${quantity} × ${panier.value.name} ajouté${quantity > 1 ? "s" : ""} au panier.`);
}
</script>

<template>
  <div v-if="panier" class="panier-detail">
    <div class="container">

      <div class="panier-detail-grid">
        <div class="panier-detail-media">
          <img v-if="panier.image" :src="panier.image" :srcset="srcsetFor(panier.image)" sizes="(max-width: 800px) 92vw, 480px" :alt="panier.name" decoding="async" />
          <span v-else class="panier-detail-placeholder" aria-hidden="true">{{ panier.icon || "🧺" }}</span>
          <span v-if="panier.image" class="panier-detail-icon" aria-hidden="true">{{ panier.icon }}</span>
        </div>

        <div class="panier-detail-body">
          <p class="eyebrow">{{ panier.itemCount }} articles</p>
          <h1>{{ panier.name }}</h1>
          <p class="panier-detail-price">{{ Number(panier.price).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) }} €</p>
          <p class="panier-detail-summary">{{ panier.summary }}</p>

          <section v-if="composition" class="composer" aria-labelledby="composer-title">
            <h2 id="composer-title">Composez votre panier</h2>
            <p class="composer-help">
              Ce panier contient <strong>{{ composition.maxItems }} articles</strong>. Vous pouvez remplacer un article par un autre
              ou en prendre en double, <strong>sans changer le prix</strong>, tant que le total ne dépasse pas
              {{ composition.maxItems }} articles<template v-if="composition.requireFull"> (le panier doit être <strong>complet</strong> pour être commandé)</template>. Pour remplacer un article, utilisez « Remplacer par… » : n'importe quel article peut être
              remplacé par un autre.
            </p>

            <div class="composer-counter" :class="{ full: remaining === 0 }" role="status" aria-live="polite">
              <div class="composer-counter-text">
                <strong>{{ total }} / {{ composition.maxItems }} articles</strong>
                <span v-if="remaining === 0">Votre panier est complet.</span>
                <span v-else>Il vous reste {{ remaining }} article{{ remaining > 1 ? "s" : "" }} à choisir.</span>
              </div>
              <div class="composer-bar" aria-hidden="true">
                <span :style="{ width: Math.min(100, (total / composition.maxItems) * 100) + '%' }"></span>
              </div>
              <button v-if="!isDefault" type="button" class="link-btn" @click="resetChoice">Revenir au panier d'origine</button>
            </div>

            <h3 class="composer-group">Dans votre panier</h3>
            <ul class="composer-list">
              <li v-for="entry in baseEntries" :key="entry.name" :class="{ off: choice[entry.name] === 0 || entry.soldOut }">
                <div class="composer-name">
                  <strong>{{ entry.name }}</strong>
                  <small v-if="entry.soldOut" class="sold-out-note">Rupture cette semaine : choisissez un remplacement</small>
                  <small v-else-if="entry.note">{{ entry.note }}</small>
                </div>
                <select v-if="swapTargets(entry).length" class="swap-select" :aria-label="`Remplacer ${entry.name} par`" @change="swapWith(entry, $event)">
                  <option value="">Remplacer par…</option>
                  <option v-for="other in swapTargets(entry)" :key="other.name" :value="other.name">{{ other.name }}</option>
                </select>

                <div class="qty-stepper">
                  <button type="button" :disabled="choice[entry.name] <= 0" :aria-label="`Retirer un ${entry.name}`" @click="bump(entry, -1)">−</button>
                  <input type="number" min="0" :max="entry.max" :value="choice[entry.name]" :aria-label="`Quantité de ${entry.name}`" @change="setFromInput(entry, $event)" />
                  <button type="button" :disabled="!canAdd(entry)" :aria-label="`Ajouter un ${entry.name}`" @click="bump(entry, 1)">+</button>
                </div>
              </li>
            </ul>

            <template v-if="replacementEntries.length">
              <h3 class="composer-group">Articles de remplacement</h3>
              <ul class="composer-list">
                <li v-for="entry in replacementEntries" :key="entry.name" :class="{ on: choice[entry.name] > 0 }">
                  <div class="composer-name">
                    <strong>{{ entry.name }}</strong>
                    <small v-if="entry.soldOut" class="sold-out-note">Rupture cette semaine : choisissez un remplacement</small>
                  <small v-else-if="entry.note">{{ entry.note }}</small>
                  </div>
                  <div class="qty-stepper">
                    <button type="button" :disabled="choice[entry.name] <= 0" :aria-label="`Retirer un ${entry.name}`" @click="bump(entry, -1)">−</button>
                    <input type="number" min="0" :max="entry.max" :value="choice[entry.name]" :aria-label="`Quantité de ${entry.name}`" @change="setFromInput(entry, $event)" />
                    <button type="button" :disabled="!canAdd(entry)" :aria-label="`Ajouter un ${entry.name}`" @click="bump(entry, 1)">+</button>
                  </div>
                </li>
              </ul>
            </template>
          </section>

          <div class="order-box">
            <label class="qty-field">
              Quantité
              <input type="number" min="1" max="50" v-model.number="qty" />
            </label>
            <button type="button" class="btn primary" @click="handleAdd(true)">
              {{ editingKey ? "Enregistrer mes changements" : "Commander ce panier" }}
            </button>
            <button v-if="!editingKey" type="button" class="btn ghost" @click="handleAdd(false)">
              Ajouter et continuer mes achats
            </button>
            <a v-if="site.whatsappNumber" :href="whatsappLink" target="_blank" rel="noreferrer" class="btn whatsapp">
              Commander sur WhatsApp
            </a>
          </div>

          <div v-if="!composition" class="panier-detail-section">
            <h2>Ce que contient ce panier</h2>
            <ul class="items-list">
              <li v-for="item in panier.items" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div v-if="panier.details" class="panier-detail-section">
            <h2>Description</h2>
            <p>{{ panier.details }}</p>
          </div>

          <div v-if="panier.origin" class="panier-detail-section">
            <h2>Origine</h2>
            <p>{{ panier.origin }}</p>
          </div>
        </div>
      </div>

      <section v-if="others.length" class="others" aria-labelledby="others-title">
        <h2 id="others-title">Découvrez aussi</h2>
        <div class="others-grid">
          <PanierCard v-for="other in others" :key="other.slug" :panier="other" />
        </div>
      </section>
    </div>
  </div>

  <div v-else-if="catalog.state.loading" class="panier-not-found">
    <div class="container">
      <p>Chargement…</p>
    </div>
  </div>

  <div v-else-if="catalog.state.error" class="panier-not-found">
    <div class="container">
      <LoadError :message="catalog.state.error" @retry="catalog.load" />
    </div>
  </div>

  <div v-else class="panier-not-found">
    <div class="container">
      <h1>Panier introuvable</h1>
      <p>Ce panier n'existe pas ou n'est plus disponible.</p>
      <RouterLink to="/" class="btn primary">Retour à l'accueil</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.sold-out-note {
  color: var(--hibiscus);
  font-weight: 700;
}

.swap-select {
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  max-width: 150px;
}

.composer {
  margin: 24px 0;
  padding: 20px 22px 22px;
  background: #fff;
  border: 2px solid var(--brand);
  border-radius: 16px;
}

.composer h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.composer-help {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--muted);
}

.composer-counter {
  position: sticky;
  top: 8px;
  z-index: 2;
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 18px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-tint);
  border-radius: 12px;
}

.composer-counter.full {
  background: var(--brand-tint);
  border-color: var(--brand);
}

.composer-counter-text {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  font-size: 14px;
}

.composer-counter-text strong {
  font-size: 18px;
  color: var(--brand-dark);
}

.composer-bar {
  height: 8px;
  background: #fff;
  border-radius: 999px;
  overflow: hidden;
}

.composer-bar span {
  display: block;
  height: 100%;
  background: var(--brand);
  border-radius: 999px;
  transition: width 0.25s ease;
}

.composer-counter .link-btn {
  justify-self: start;
}

.composer-group {
  margin: 18px 0 8px;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--brand-dark);
}

.composer-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.composer-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  transition: background 0.2s, opacity 0.2s;
}

.composer-list li.off {
  opacity: 0.55;
  background: #f6f4ef;
}

.composer-list li.on {
  background: var(--brand-soft);
  border-color: var(--brand);
}

.composer-name {
  display: grid;
  gap: 2px;
}

.composer-name small {
  color: var(--muted);
}

.qty-stepper {
  display: inline-flex;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 999px;
  overflow: hidden;
  background: #fff;
}

.qty-stepper button {
  width: 34px;
  height: 34px;
  border: 0;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
}

.qty-stepper button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.qty-stepper input {
  width: 38px;
  text-align: center;
  border: 0;
  font: inherit;
  font-weight: 700;
  -moz-appearance: textfield;
}

.qty-stepper input::-webkit-outer-spin-button,
.qty-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
}

.others {
  margin-top: 72px;
  padding-top: 40px;
  border-top: 1px solid var(--line);
}

.others h2 {
  font-size: 24px;
  margin: 0 0 24px;
}

.others-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
}

.panier-detail {
  padding: 48px 0 80px;
}

.back-link {
  display: inline-block;
  margin-bottom: 28px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--muted);
}

.back-link:hover {
  color: var(--brand);
}

.panier-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 48px;
  align-items: start;
}

.panier-detail-media {
  position: sticky;
  top: 100px;
  height: 320px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--cream-deep);
}

.panier-detail-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.panier-detail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72px;
  opacity: 0.5;
}

.panier-detail-icon {
  position: absolute;
  margin: 14px;
  font-size: 28px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.qty-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}

.qty-field input {
  width: 70px;
  padding: 10px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  font: inherit;
}

.panier-detail-body h1 {
  font-size: 32px;
  margin: 4px 0 12px;
}

.panier-detail-price {
  font-size: 22px;
  font-weight: 700;
  color: var(--brand-dark);
  margin: 0 0 16px;
}

.panier-detail-summary {
  color: var(--muted);
  margin: 0 0 24px;
}

.panier-detail-section {
  margin-top: 36px;
}

.panier-detail-section h2 {
  font-size: 18px;
  margin: 0 0 12px;
}

.panier-detail-section p {
  color: var(--muted);
  margin: 0;
}

.items-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.items-list li {
  padding: 10px 14px;
  background: var(--cream-deep);
  border-radius: 10px;
  font-size: 14px;
}

.panier-not-found {
  padding: 100px 0;
  text-align: center;
}

.panier-not-found p {
  color: var(--muted);
  margin: 12px 0 28px;
}

@media (max-width: 760px) {
  .panier-detail-grid {
    grid-template-columns: 1fr;
  }

  .panier-detail-media {
    position: static;
    height: 220px;
  }

  .items-list {
    grid-template-columns: 1fr;
  }
}
</style>
