<script setup>
import { reactive, ref, onMounted, computed, watch, nextTick } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../api.js";
import { useCart } from "../stores/cart.js";
import { useAuth } from "../stores/auth.js";
import { site, whatsappCartLink, whatsappOrderConfirmLink } from "../data/site.js";
import CartLineContents from "../components/CartLineContents.vue";
import WeeklyRhythm from "../components/WeeklyRhythm.vue";
import PickupCode from "../components/PickupCode.vue";
import { formatOrderCode, saveLastOrder, loadLastOrder } from "../utils/orderCode.js";
import { useSiteContent } from "../stores/siteContent.js";

const cart = useCart();
const auth = useAuth();
const route = useRoute();
const router = useRouter();

const MAX_QTY = 50;

const siteContent = useSiteContent();

// Session de vente (donnée par le serveur) : hors session, on ne peut pas commander.
const salesClosed = computed(() => siteContent.state.sales?.open === false);
const salesMessage = computed(() => {
  const sales = siteContent.state.sales;
  if (!sales || sales.open) return "";
  return (
    sales.closedMessage ||
    (sales.mode === "closed"
      ? "La vente est fermée pour le moment."
      : `La vente est fermée : elle rouvre samedi${sales.opensInDays ? ` (dans ${sales.opensInDays} jour${sales.opensInDays > 1 ? "s" : ""})` : ""} et ferme le lundi soir.`)
  );
});
const pickupDate = computed(() => siteContent.state.sales?.pickupDate || "");

function formatDay(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
const STEP_QUERY = { 2: "coordonnees", 3: "relecture" };

const form = reactive({
  name: "",
  phone: "",
  email: "",
  fulfillment: "retrait",
  address: "",
  notes: "",
  reminder: false, // rappel du lundi par email
  website: "" // honeypot — doit rester vide
});

const errors = reactive({ name: "", phone: "", email: "", address: "" });

// Infos de retrait / livraison saisies par L'Héritage des Mornes, rappelées sous le choix du mode.
const modeInfo = computed(() =>
  form.fulfillment === "livraison" ? siteContent.state.checkout.deliveryInfo : siteContent.state.checkout.pickupInfo
);

const status = ref("idle"); // idle | sending | success | error
const errorMessage = ref("");
const lastOrder = ref(null);
// Code de la dernière commande de cet appareil : rappelé si l'onglet a été fermé entre-temps.
const previousOrder = ref(loadLastOrder());

const discountInput = ref("");
const discount = ref(null); // { code, amount }
const discountError = ref("");
const discountChecking = ref(false);

// Relecture : le serveur revérifie prix et disponibilité avant que le client ne confirme.
const review = reactive({ loading: false, error: "", checked: false, confirmed: false });
const notices = ref([]); // messages sur ce qui a changé depuis l'ajout au panier

function fieldErrors() {
  return {
    name: form.name.trim() ? "" : "Merci d'indiquer votre nom.",
    phone: /^[+\d][\d\s().-]{7,}$/.test(form.phone.trim())
      ? ""
      : "Merci d'indiquer un numéro de téléphone valide (8 chiffres minimum).",
    email: !form.email.trim() || /^\S+@\S+\.\S+$/.test(form.email.trim()) ? "" : "Cette adresse email semble incorrecte.",
    address: form.fulfillment === "livraison" && !form.address.trim() ? "Merci d'indiquer l'adresse de livraison." : ""
  };
}

const formComplete = computed(() => !Object.values(fieldErrors()).some(Boolean));

// L'étape vit dans l'URL (?etape=…) : le bouton retour du navigateur fonctionne.
// On ne peut pas arriver sur la relecture sans coordonnées valides.
const step = computed(() => {
  if (cart.items.value.length === 0) return 1;
  if (route.query.etape === "relecture") return formComplete.value ? 3 : 2;
  if (route.query.etape === "coordonnees") return 2;
  return 1;
});

const total = computed(() => Math.max(0, Math.round((cart.subtotal.value - (discount.value?.amount || 0)) * 100) / 100));

onMounted(async () => {
  if (!auth.state.loaded) await auth.fetchMe();
  if (auth.state.customer) {
    form.name = auth.state.customer.name || "";
    form.phone = auth.state.customer.phone || "";
    form.email = auth.state.customer.email || "";
    form.fulfillment = auth.state.customer.defaultFulfillment === "livraison" ? "livraison" : "retrait";
    form.address = auth.state.customer.address || "";
  }
});

function formatPrice(value) {
  return Number(Number(value).toFixed(2)).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function goToStep(next) {
  router.push({ path: "/commande", query: STEP_QUERY[next] ? { etape: STEP_QUERY[next] } : {} });
}

function changeQty(item, delta) {
  cart.setQty(item.key, Math.min(item.qty + delta, MAX_QTY));
}

function setQtyFromInput(item, event) {
  const value = Math.floor(Number(event.target.value));
  if (!Number.isFinite(value)) {
    event.target.value = item.qty;
    return;
  }
  cart.setQty(item.key, Math.min(value, MAX_QTY));
}

async function applyDiscount({ silent = false } = {}) {
  discountError.value = "";
  if (!discountInput.value.trim()) {
    discount.value = null;
    return;
  }

  discountChecking.value = true;
  const res = await api("/api/discounts/validate", {
    method: "POST",
    body: { code: discountInput.value, subtotal: cart.subtotal.value }
  });
  discountChecking.value = false;

  if (res.ok) {
    discount.value = { code: res.data.code, amount: res.data.amount };
  } else {
    discount.value = null;
    if (!silent) discountError.value = res.error || "Code invalide.";
  }
}

// Le montant d'une réduction en % dépend du panier : on le recalcule quand les quantités changent.
watch(
  () => cart.subtotal.value,
  () => {
    if (discount.value) applyDiscount({ silent: true });
  }
);

// Applique le résultat d'une relecture serveur au panier local et prépare les messages.
function absorbServerCheck({ lines = [], unavailable = [], adjusted = [], priceChanges = [] }) {
  notices.value = [
    ...unavailable.map((u) => ({ kind: "removed", text: `« ${u.name} » a été retiré de votre panier : ${u.reason}` })),
    ...adjusted.map((a) => ({
      kind: "adjusted",
      text: `La composition de « ${a.name} » a changé, votre choix a été ajusté : ${a.changes.join(" ")} Vérifiez-le avant de confirmer.`,
      slug: a.slug,
      key: a.key
    })),
    ...priceChanges.map((c) => ({
      kind: "price",
      text: `Le prix de « ${c.name} » est passé de ${formatPrice(c.previousPrice)} € à ${formatPrice(c.price)} €.`
    }))
  ];
  cart.applyServerCheck({ lines, unavailable, adjusted });
}

async function runReview() {
  review.loading = true;
  review.error = "";
  review.checked = false;
  review.confirmed = false;
  const res = await api("/api/cart/check", { method: "POST", body: { items: cart.toPayload() } });
  review.loading = false;
  if (!res.ok) {
    review.error = res.error;
    return;
  }
  siteContent.setSales(res.data.sales);
  absorbServerCheck(res.data);
  if (discount.value) await applyDiscount({ silent: true });
  review.checked = true;
}

watch(
  step,
  (current) => {
    if (current === 3) runReview();
  },
  { immediate: true }
);

function validate() {
  Object.assign(errors, fieldErrors());
  return !Object.values(errors).some(Boolean);
}

async function focusFirstError() {
  await nextTick();
  document.querySelector(".order-form [aria-invalid='true']")?.focus();
}

function goToReview() {
  status.value = "idle";
  if (!validate()) {
    status.value = "error";
    errorMessage.value = "Quelques informations sont à corriger ci-dessous.";
    focusFirstError();
    return;
  }
  goToStep(3);
}

async function submitOrder() {
  if (cart.items.value.length === 0 || status.value === "sending") return;
  if (!review.checked || !review.confirmed) return;

  status.value = "sending";
  errorMessage.value = "";

  const res = await api("/api/orders", {
    method: "POST",
    body: {
      customer: {
        name: form.name,
        phone: form.phone,
        email: form.email,
        fulfillment: form.fulfillment,
        address: form.fulfillment === "livraison" ? form.address : "",
        notes: form.notes,
        reminder: form.reminder && Boolean(form.email.trim())
      },
      items: cart.toPayload(),
      discountCode: discount.value?.code || "",
      website: form.website
    }
  });

  if (!res.ok) {
    status.value = "error";
    if (res.status === 403 && res.data?.code === "SALES_CLOSED") {
      siteContent.setSales(res.data.sales);
      review.confirmed = false;
      errorMessage.value = res.error;
      return;
    }
    // Le panier a changé entre la relecture et l'envoi : on remet le client devant ce qui a bougé.
    if (res.status === 409 && (res.data?.unavailable || res.data?.priceChanges || res.data?.adjusted)) {
      absorbServerCheck({
        unavailable: res.data.unavailable || [],
        adjusted: res.data.adjusted || [],
        priceChanges: res.data.priceChanges || []
      });
      review.confirmed = false;
      errorMessage.value = res.error;
      const kept = notices.value;
      await runReview();
      notices.value = [...kept, ...notices.value];
      return;
    }
    errorMessage.value = res.error || "Une erreur est survenue. Réessayez ou passez par WhatsApp.";
    return;
  }

  lastOrder.value = { ...res.data, fulfillment: form.fulfillment };
  saveLastOrder({ code: res.data.orderId, name: res.data.customer?.name, total: res.data.total });
  previousOrder.value = null;
  cart.clear();
  discount.value = null;
  discountInput.value = "";
  notices.value = [];
  status.value = "success";
  window.scrollTo({ top: 0 });
}
</script>

<template>
  <div class="checkout">
    <div class="container">
      <p class="eyebrow">Votre commande</p>
      <h1>Panier &amp; commande</h1>
      <WeeklyRhythm v-if="status !== 'success'" compact />

      <p v-if="salesClosed && status !== 'success'" class="sales-closed" role="alert">
        <strong>{{ salesMessage }}</strong>
        Vous pouvez préparer votre panier dès maintenant : il sera conservé sur cet appareil.
      </p>

      <div v-if="status === 'success'" class="success-box" role="status">
        <h2>Commande envoyée, merci {{ lastOrder?.customer?.name }} !</h2>
        <PickupCode v-if="lastOrder?.orderId" :code="lastOrder.orderId" />
        <ol class="code-steps">
          <li><strong>Gardez ce code</strong> : faites une capture d'écran ou notez-le (il est aussi envoyé par email si vous en avez donné un).</li>
          <li>
            <strong>Le mercredi</strong>, donnez-le à L'Héritage des Mornes
            {{ lastOrder?.fulfillment === "livraison" ? "à la livraison" : "au retrait" }} : il permet de retrouver votre commande et de vous servir tout de suite.
          </li>
          <li>Total à régler sur place : <strong>{{ formatPrice(lastOrder?.total || 0) }} €</strong>. La vente ferme le lundi soir.</li>
        </ol>
        <div class="success-actions">
          <a
            v-if="site.whatsappNumber"
            :href="whatsappOrderConfirmLink(lastOrder?.orderId, lastOrder?.customer?.name)"
            target="_blank"
            rel="noreferrer"
            class="btn whatsapp"
          >
            Prévenir L'Héritage des Mornes sur WhatsApp
          </a>
          <RouterLink v-if="auth.state.customer" to="/compte" class="btn ghost">Suivre mes commandes</RouterLink>
          <RouterLink to="/" class="btn ghost">Retour à l'accueil</RouterLink>
        </div>
        <p v-if="!auth.state.customer" class="account-hint">
          <RouterLink to="/compte/inscription">Créez un compte</RouterLink> pour suivre cette commande : une fois connecté·e, utilisez
          « Retrouver une commande » avec le code <strong>{{ formatOrderCode(lastOrder?.orderId) }}</strong> et votre téléphone.
          Si vous avez donné un email, confirmez-le simplement et vos commandes seront ajoutées automatiquement.
        </p>
      </div>

      <template v-else>
        <div v-if="notices.length > 0" class="notices" role="alert">
          <strong>Votre panier a été mis à jour :</strong>
          <ul>
            <li v-for="(notice, index) in notices" :key="index">{{ notice.text }}</li>
          </ul>
        </div>

        <div v-if="cart.items.value.length === 0" class="empty-box">
          <p>Votre panier est vide pour le moment.</p>
          <PickupCode v-if="previousOrder" :code="previousOrder.code" title="Votre dernier code de retrait" compact class="previous-code" />
          <div class="success-actions">
            <RouterLink to="/#paniers" class="btn primary">Voir les paniers</RouterLink>
            <RouterLink to="/composer" class="btn ghost">Composer mon panier</RouterLink>
            <RouterLink to="/produits" class="btn ghost">Choisir à la carte</RouterLink>
          </div>
        </div>

        <template v-else>
          <ol class="stepper" aria-label="Étapes de la commande">
            <li :class="{ current: step === 1, done: step > 1 }" :aria-current="step === 1 ? 'step' : undefined">
              <span class="step-number">1</span> Mon panier
            </li>
            <li :class="{ current: step === 2, done: step > 2 }" :aria-current="step === 2 ? 'step' : undefined">
              <span class="step-number">2</span> Mes coordonnées
            </li>
            <li :class="{ current: step === 3 }" :aria-current="step === 3 ? 'step' : undefined">
              <span class="step-number">3</span> Relecture
            </li>
          </ol>

          <!-- Étape 1 : panier, code promo, total -->
          <div v-if="step === 1" class="cart-step">
            <div class="cart-list">
              <h2>Mes articles</h2>
              <div v-for="item in cart.items.value" :key="item.key" class="cart-row">
                <div class="cart-row-main">
                  <strong>{{ item.name }}</strong>
                  <span v-if="item.type === 'custom'" class="line-tag">Panier sur mesure</span>
                  <span v-else-if="item.selection" class="line-tag">Personnalisé</span>
                  <span class="cart-row-price">{{ formatPrice(item.price) }} € / {{ item.type === "custom" || item.type === "basket" ? "panier" : item.unit || "unité" }}</span>
                  <CartLineContents :line="item" />
                  <RouterLink v-if="item.type === 'basket' && item.selection" :to="{ path: `/panier/${item.slug}`, query: { ligne: item.key } }" class="edit-link">
                    Modifier le contenu
                  </RouterLink>
                  <RouterLink v-if="item.type === 'custom'" :to="{ path: '/composer', query: { panier: item.key } }" class="edit-link">
                    Modifier ce panier
                  </RouterLink>
                </div>
                <div class="cart-row-controls">
                  <div class="qty-stepper">
                    <button type="button" :aria-label="`Retirer un ${item.name}`" @click="changeQty(item, -1)">−</button>
                    <input
                      type="number"
                      min="1"
                      :max="MAX_QTY"
                      :value="item.qty"
                      :aria-label="`Quantité de ${item.name}`"
                      @change="setQtyFromInput(item, $event)"
                    />
                    <button type="button" :aria-label="`Ajouter un ${item.name}`" @click="changeQty(item, 1)">+</button>
                  </div>
                  <span class="cart-row-total">{{ formatPrice(item.price * item.qty) }} €</span>
                  <button type="button" class="link-btn" :aria-label="`Retirer ${item.name} du panier`" @click="cart.removeItem(item.key)">
                    Retirer
                  </button>
                </div>
              </div>

              <div class="add-more">
                <RouterLink to="/composer" class="btn ghost">+ Composer un panier sur mesure</RouterLink>
                <RouterLink to="/#paniers" class="btn ghost">+ Ajouter un panier</RouterLink>
                <RouterLink to="/produits" class="btn ghost">+ Ajouter des articles</RouterLink>
              </div>

              <div class="discount-box">
                <label for="discount-code">Code promo</label>
                <div class="discount-input-row">
                  <input
                    id="discount-code"
                    v-model.trim="discountInput"
                    type="text"
                    placeholder="ex: BIENVENUE10"
                    autocomplete="off"
                    @keydown.enter.prevent="applyDiscount()"
                  />
                  <button type="button" class="btn ghost" :disabled="discountChecking" @click="applyDiscount()">
                    {{ discountChecking ? "…" : "Appliquer" }}
                  </button>
                </div>
                <p v-if="discountError" class="form-error" role="alert">{{ discountError }}</p>
                <p v-if="discount" class="discount-applied" role="status">
                  Code {{ discount.code }} appliqué : -{{ formatPrice(discount.amount) }} €
                </p>
              </div>

              <div class="cart-total">
                <span>Sous-total</span>
                <span>{{ formatPrice(cart.subtotal.value) }} €</span>
              </div>
              <div v-if="discount" class="cart-total discount-line">
                <span>Réduction</span>
                <span>-{{ formatPrice(discount.amount) }} €</span>
              </div>
              <div class="cart-total cart-total-final">
                <span>Total</span>
                <strong>{{ formatPrice(total) }} €</strong>
              </div>

              <button type="button" class="btn primary continue-btn" :disabled="salesClosed" @click="goToStep(2)">Continuer →</button>

              <a v-if="site.whatsappNumber" :href="whatsappCartLink(cart.items.value)" target="_blank" rel="noreferrer" class="whatsapp-alt">
                Préférer commander ce panier sur WhatsApp
              </a>
            </div>
          </div>

          <!-- Étape 2 : coordonnées + récapitulatif -->
          <div v-else-if="step === 2" class="checkout-grid">
            <form class="order-form" novalidate @submit.prevent="goToReview">
              <h2>Vos coordonnées</h2>
              <p v-if="!auth.state.customer" class="guest-note">
                Pas besoin de compte pour commander — remplissez simplement vos coordonnées ci-dessous.
              </p>

              <div class="field">
                <label for="f-name">Nom et prénom *</label>
                <input
                  id="f-name"
                  v-model.trim="form.name"
                  type="text"
                  autocomplete="name"
                  required
                  :aria-invalid="errors.name ? 'true' : undefined"
                  :aria-describedby="errors.name ? 'f-name-error' : undefined"
                />
                <p v-if="errors.name" id="f-name-error" class="field-error">{{ errors.name }}</p>
              </div>

              <div class="field">
                <label for="f-phone">Téléphone *</label>
                <input
                  id="f-phone"
                  v-model.trim="form.phone"
                  type="tel"
                  autocomplete="tel"
                  required
                  :aria-invalid="errors.phone ? 'true' : undefined"
                  :aria-describedby="errors.phone ? 'f-phone-error' : undefined"
                />
                <p v-if="errors.phone" id="f-phone-error" class="field-error">{{ errors.phone }}</p>
              </div>

              <div class="field">
                <label for="f-email">Email (optionnel, pour recevoir un message à chaque étape de votre commande)</label>
                <input
                  id="f-email"
                  v-model.trim="form.email"
                  type="email"
                  autocomplete="email"
                  :aria-invalid="errors.email ? 'true' : undefined"
                  :aria-describedby="errors.email ? 'f-email-error' : undefined"
                />
                <p v-if="errors.email" id="f-email-error" class="field-error">{{ errors.email }}</p>
                <label v-if="form.email" class="reminder-check">
                  <input v-model="form.reminder" type="checkbox" />
                  <span>Me rappeler par email le lundi si je n'ai pas encore commandé (désinscription en un clic).</span>
                </label>
              </div>

              <fieldset class="fulfillment-field">
                <legend>Mode</legend>
                <label class="radio">
                  <input type="radio" value="retrait" v-model="form.fulfillment" />
                  Retrait
                </label>
                <label class="radio">
                  <input type="radio" value="livraison" v-model="form.fulfillment" />
                  Livraison
                </label>
              </fieldset>

              <p v-if="modeInfo" class="mode-info">{{ modeInfo }}</p>

              <p v-if="pickupDate" class="pickup-date">
                🧺 {{ form.fulfillment === "livraison" ? "Livraison" : "Retrait" }} le <strong>{{ formatDay(pickupDate) }}</strong>
                (une seule date par session de vente).
              </p>

              <div v-if="form.fulfillment === 'livraison'" class="field">
                <label for="f-address">Adresse de livraison *</label>
                <textarea
                  id="f-address"
                  v-model.trim="form.address"
                  rows="2"
                  autocomplete="street-address"
                  :aria-invalid="errors.address ? 'true' : undefined"
                  :aria-describedby="errors.address ? 'f-address-error' : undefined"
                ></textarea>
                <p v-if="errors.address" id="f-address-error" class="field-error">{{ errors.address }}</p>
              </div>

              <div class="field">
                <label for="f-notes">Remarques (allergies, créneau préféré, etc.)</label>
                <textarea id="f-notes" v-model.trim="form.notes" rows="2"></textarea>
              </div>

              <input
                v-model="form.website"
                type="text"
                autocomplete="off"
                tabindex="-1"
                class="honeypot"
                aria-hidden="true"
              />

              <p v-if="status === 'error'" class="form-error" role="alert">{{ errorMessage }}</p>

              <div class="form-actions">
                <button type="button" class="btn ghost" @click="goToStep(1)">← Modifier mon panier</button>
                <button type="submit" class="btn primary">Relire ma commande →</button>
              </div>
            </form>

            <aside class="recap" aria-label="Récapitulatif de la commande">
              <h2>Récapitulatif</h2>
              <ul>
                <li v-for="item in cart.items.value" :key="item.key">
                  <span>{{ item.qty }} × {{ item.name }}</span>
                  <span>{{ formatPrice(item.price * item.qty) }} €</span>
                </li>
              </ul>
              <div v-if="discount" class="cart-total discount-line">
                <span>Code {{ discount.code }}</span>
                <span>-{{ formatPrice(discount.amount) }} €</span>
              </div>
              <div class="cart-total cart-total-final">
                <span>Total</span>
                <strong>{{ formatPrice(total) }} €</strong>
              </div>
            </aside>
          </div>

          <!-- Étape 3 : relecture et confirmation -->
          <div v-else class="review">
            <p v-if="review.loading" class="muted-note" role="status">Vérification de votre panier (prix et disponibilités)…</p>

            <div v-else-if="review.error" class="review-error" role="alert">
              <p>{{ review.error }}</p>
              <button type="button" class="btn ghost" @click="runReview">Réessayer</button>
            </div>

            <template v-else-if="review.checked">
              <div class="review-card">
                <div class="review-head">
                  <h2>Vos articles</h2>
                  <button type="button" class="link-btn" @click="goToStep(1)">Modifier</button>
                </div>
                <div v-for="item in cart.items.value" :key="item.key" class="review-line">
                  <div>
                    <strong>{{ item.qty }} × {{ item.name }}</strong>
                    <span v-if="item.type === 'custom'" class="line-tag">Panier sur mesure</span>
                    <CartLineContents :line="item" open />
                  </div>
                  <span>{{ formatPrice(item.price * item.qty) }} €</span>
                </div>
                <div v-if="discount" class="cart-total discount-line">
                  <span>Code {{ discount.code }}</span>
                  <span>-{{ formatPrice(discount.amount) }} €</span>
                </div>
                <div class="cart-total cart-total-final">
                  <span>Total à régler</span>
                  <strong>{{ formatPrice(total) }} €</strong>
                </div>
                <p class="muted-note">Le paiement se fait à la remise de votre commande.</p>
              </div>

              <div class="review-card">
                <div class="review-head">
                  <h2>{{ form.fulfillment === "livraison" ? "Livraison" : "Retrait" }}</h2>
                  <button type="button" class="link-btn" @click="goToStep(2)">Modifier</button>
                </div>
                <dl class="review-contact">
                  <dt>Nom</dt>
                  <dd>{{ form.name }}</dd>
                  <dt>Téléphone</dt>
                  <dd>{{ form.phone }}</dd>
                  <template v-if="form.email">
                    <dt>Email</dt>
                    <dd>{{ form.email }}</dd>
                  </template>
                  <template v-if="pickupDate">
                    <dt>{{ form.fulfillment === "livraison" ? "Livraison" : "Retrait" }}</dt>
                    <dd>{{ formatDay(pickupDate) }}</dd>
                  </template>
                  <template v-if="form.fulfillment === 'livraison'">
                    <dt>Adresse</dt>
                    <dd>{{ form.address }}</dd>
                  </template>
                  <template v-if="form.notes">
                    <dt>Remarques</dt>
                    <dd>{{ form.notes }}</dd>
                  </template>
                </dl>
              </div>

              <div class="confirm-box">
                <label class="confirm-check">
                  <input v-model="review.confirmed" type="checkbox" />
                  <span>
                    Je confirme ma commande : j'ai vérifié les articles, les quantités et le total ({{ formatPrice(total) }} €).
                  </span>
                </label>
                <p class="legal-note">
                  En confirmant, vous acceptez les
                  <RouterLink to="/conditions" target="_blank">conditions de commande</RouterLink> et la
                  <RouterLink to="/confidentialite" target="_blank">politique de confidentialité</RouterLink>.
                </p>
                <p v-if="status === 'error'" class="form-error" role="alert">{{ errorMessage }}</p>
                <div class="form-actions">
                  <button type="button" class="btn ghost" @click="goToStep(2)">← Retour</button>
                  <button
                    type="button"
                    class="btn primary"
                    :disabled="!review.confirmed || status === 'sending' || salesClosed"
                    @click="submitOrder"
                  >
                    {{ status === "sending" ? "Envoi en cours…" : "Confirmer et envoyer ma commande" }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sales-closed {
  margin: 0 0 18px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #fdf0e6;
  border: 1.5px solid var(--clay);
  display: grid;
  gap: 4px;
}

.pickup-date {
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--brand-soft);
  font-size: 14px;
}

.reminder-check {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
}

.checkout {
  padding: 48px 0 80px;
  min-height: 60vh;
}

h1 {
  font-size: 30px;
  margin: 4px 0 24px;
}

.stepper {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 0 0 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
}

.stepper li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--cream-deep);
}

.stepper li.current {
  background: var(--brand);
  color: #fff;
}

.stepper li.done {
  color: var(--brand-dark);
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
  font-size: 12px;
}

.notices {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #f0d06a;
  background: #fff6d6;
  color: #664400;
  font-size: 14px;
}

.notices ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.empty-box,
.success-box {
  text-align: center;
  padding: 60px 20px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
}

.success-box h2 {
  font-size: 22px;
  margin: 0 0 12px;
}

.success-box p {
  color: var(--muted);
  max-width: 520px;
  margin: 0 auto 24px;
}

.empty-box p {
  color: var(--muted);
  margin: 0 0 20px;
}

.code-steps {
  text-align: left;
  max-width: 520px;
  margin: 22px auto 26px;
  padding-left: 22px;
  color: var(--muted);
  font-size: 14px;
}

.code-steps li {
  margin-bottom: 8px;
}

.previous-code {
  margin-bottom: 22px;
}

.success-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.cart-step {
  max-width: 760px;
}

.checkout-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 32px;
  align-items: start;
}

.cart-list,
.order-form,
.recap,
.review-card,
.confirm-box {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.cart-list h2,
.order-form h2,
.recap h2,
.review-card h2 {
  font-size: 18px;
  margin: 0 0 18px;
}

.recap {
  position: sticky;
  top: 96px;
}

.recap ul {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  font-size: 14px;
}

.recap li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.muted-note {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.guest-note {
  margin: -10px 0 18px;
  font-size: 13px;
  color: var(--muted);
  background: var(--cream-deep);
  border-radius: 8px;
  padding: 10px 12px;
}

.cart-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
  gap: 12px;
  flex-wrap: wrap;
}

.cart-row-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.line-tag {
  justify-self: start;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--brand-tint);
  color: var(--brand-dark);
}

.edit-link {
  justify-self: start;
  font-size: 13px;
  font-weight: 600;
  color: var(--clay-dark);
}

.cart-row-price {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.cart-row-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.cart-row-total {
  min-width: 56px;
  text-align: right;
  font-weight: 700;
  font-size: 14px;
}

.add-more {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px 0 4px;
}

.add-more .btn {
  padding: 8px 12px;
  font-size: 13px;
}

.qty-stepper {
  display: inline-flex;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.qty-stepper button {
  width: 36px;
  height: 36px;
  border: 0;
  background: var(--cream-deep);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--text);
}

.qty-stepper input {
  width: 48px;
  height: 36px;
  border: 0;
  text-align: center;
  font: inherit;
  -moz-appearance: textfield;
}

.qty-stepper input::-webkit-outer-spin-button,
.qty-stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.link-btn {
  background: none;
  border: 0;
  color: var(--clay-dark);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.discount-box {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.discount-box label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.discount-input-row {
  display: flex;
  gap: 8px;
}

.discount-input-row input {
  flex: 1;
  min-width: 0;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  font: inherit;
  text-transform: uppercase;
}

.discount-input-row .btn {
  padding: 9px 16px;
  font-size: 13px;
}

.discount-applied {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--brand-dark);
  font-weight: 600;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  font-size: 14px;
  color: var(--muted);
}

.cart-total.discount-line {
  color: var(--brand-dark);
}

.cart-total.cart-total-final {
  font-size: 18px;
  color: var(--text);
  padding-top: 10px;
}

.continue-btn {
  width: 100%;
  justify-content: center;
  margin-top: 20px;
}

.account-hint {
  font-size: 13px;
  color: var(--muted);
  margin: 20px 0 0;
}

.account-hint a {
  color: var(--clay-dark);
  font-weight: 600;
}

.whatsapp-alt {
  display: block;
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: var(--muted);
  text-decoration: underline;
}

.order-form {
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.field input,
.field textarea {
  font: inherit;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
}

.field [aria-invalid="true"] {
  border-color: #a3202a;
  background: #fef4f4;
}

.field-error {
  margin: 0;
  font-size: 12px;
  color: #a3202a;
}

.mode-info {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-tint);
  color: var(--brand-dark);
  font-size: 13px;
  white-space: pre-line;
}

.fulfillment-field {
  border: 0;
  padding: 0;
  display: flex;
  gap: 18px;
  align-items: center;
}

.fulfillment-field legend {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}

.honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.form-error {
  color: #a3202a;
  font-size: 13px;
  margin: 0;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.review {
  display: grid;
  gap: 16px;
  max-width: 760px;
}

.review-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.review-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  font-size: 14px;
}

.review-contact {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
  font-size: 14px;
}

.review-contact dt {
  color: var(--muted);
}

.review-contact dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.review-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid #f0b9bd;
  background: #fdeced;
  color: #8a1f27;
}

.review-error p {
  margin: 0;
}

.confirm-box {
  display: grid;
  gap: 16px;
  border-color: var(--brand);
}

.confirm-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.confirm-check input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.legal-note {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.legal-note a {
  color: var(--clay-dark);
  font-weight: 600;
}

.confirm-box .btn:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (max-width: 760px) {
  .checkout-grid {
    grid-template-columns: 1fr;
  }

  .recap {
    position: static;
    order: -1;
  }

  .form-actions .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
