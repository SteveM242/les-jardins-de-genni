<script setup>
import { reactive, ref, onMounted, computed, watch, nextTick } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../api.js";
import { useCart } from "../stores/cart.js";
import { useAuth } from "../stores/auth.js";
import { whatsappCartLink, whatsappOrderConfirmLink } from "../data/site.js";

const cart = useCart();
const auth = useAuth();
const route = useRoute();
const router = useRouter();

const MAX_QTY = 50;

const form = reactive({
  name: "",
  phone: "",
  email: "",
  fulfillment: "retrait",
  address: "",
  notes: "",
  website: "" // honeypot — doit rester vide
});

const errors = reactive({ name: "", phone: "", email: "", address: "" });

const status = ref("idle"); // idle | sending | success | error
const errorMessage = ref("");
const lastOrder = ref(null);

const discountInput = ref("");
const discount = ref(null); // { code, amount }
const discountError = ref("");
const discountChecking = ref(false);

// L'étape vit dans l'URL (?etape=coordonnees) : le bouton retour du navigateur fonctionne.
const step = computed(() => (route.query.etape === "coordonnees" && cart.items.value.length > 0 ? 2 : 1));

const total = computed(() => Math.max(0, cart.subtotal.value - (discount.value?.amount || 0)));

onMounted(async () => {
  if (!auth.state.loaded) await auth.fetchMe();
  if (auth.state.customer) {
    form.name = auth.state.customer.name || "";
    form.phone = auth.state.customer.phone || "";
    form.email = auth.state.customer.email || "";
    form.address = auth.state.customer.address || "";
  }
});

function formatPrice(value) {
  return Number(value.toFixed(2)).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function goToStep(next) {
  router.push({ path: "/commande", query: next === 2 ? { etape: "coordonnees" } : {} });
}

function changeQty(item, delta) {
  cart.setQty(item.type, item.slug, Math.min(item.qty + delta, MAX_QTY));
}

function setQtyFromInput(item, event) {
  const value = Math.floor(Number(event.target.value));
  if (!Number.isFinite(value)) {
    event.target.value = item.qty;
    return;
  }
  cart.setQty(item.type, item.slug, Math.min(value, MAX_QTY));
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

function validate() {
  errors.name = form.name.trim() ? "" : "Merci d'indiquer votre nom.";
  errors.phone = /^[+\d][\d\s().-]{7,}$/.test(form.phone.trim())
    ? ""
    : "Merci d'indiquer un numéro de téléphone valide (8 chiffres minimum).";
  errors.email = !form.email.trim() || /^\S+@\S+\.\S+$/.test(form.email.trim()) ? "" : "Cette adresse email semble incorrecte.";
  errors.address =
    form.fulfillment === "livraison" && !form.address.trim() ? "Merci d'indiquer l'adresse de livraison." : "";
  return !Object.values(errors).some(Boolean);
}

async function focusFirstError() {
  await nextTick();
  document.querySelector(".order-form [aria-invalid='true']")?.focus();
}

async function submitOrder() {
  if (cart.items.value.length === 0 || status.value === "sending") return;
  if (!validate()) {
    status.value = "error";
    errorMessage.value = "Quelques informations sont à corriger ci-dessous.";
    focusFirstError();
    return;
  }

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
        notes: form.notes
      },
      items: cart.items.value.map((item) => ({ type: item.type, slug: item.slug, qty: item.qty })),
      discountCode: discount.value?.code || "",
      website: form.website
    }
  });

  if (!res.ok) {
    status.value = "error";
    errorMessage.value = res.error || "Une erreur est survenue. Réessayez ou passez par WhatsApp.";
    return;
  }

  lastOrder.value = { ...res.data, fulfillment: form.fulfillment };
  cart.clear();
  discount.value = null;
  discountInput.value = "";
  status.value = "success";
  window.scrollTo({ top: 0 });
}
</script>

<template>
  <div class="checkout">
    <div class="container">
      <p class="eyebrow">Votre commande</p>
      <h1>Panier &amp; commande</h1>

      <div v-if="status === 'success'" class="success-box" role="status">
        <h2>Commande envoyée, merci {{ lastOrder?.customer?.name }} !</h2>
        <p>
          Numéro de commande : <strong>{{ lastOrder?.orderId }}</strong> — total {{ formatPrice(lastOrder?.total || 0) }} €.
          Notez-le : il vous servira si vous nous contactez. Genni va vous recontacter pour confirmer la disponibilité et le
          {{ lastOrder?.fulfillment === "livraison" ? "créneau de livraison" : "retrait" }}.
        </p>
        <div class="success-actions">
          <a
            :href="whatsappOrderConfirmLink(lastOrder?.orderId, lastOrder?.customer?.name)"
            target="_blank"
            rel="noreferrer"
            class="btn whatsapp"
          >
            Prévenir Genni sur WhatsApp
          </a>
          <RouterLink v-if="auth.state.customer" to="/compte" class="btn ghost">Suivre mes commandes</RouterLink>
          <RouterLink to="/" class="btn ghost">Retour à l'accueil</RouterLink>
        </div>
        <p v-if="!auth.state.customer" class="account-hint">
          <RouterLink to="/compte/inscription">Créez un compte</RouterLink> pour retrouver vos commandes et suivre leur statut.
        </p>
      </div>

      <div v-else-if="cart.items.value.length === 0" class="empty-box">
        <p>Votre panier est vide pour le moment.</p>
        <div class="success-actions">
          <RouterLink to="/#paniers" class="btn primary">Voir les paniers</RouterLink>
          <RouterLink to="/produits" class="btn ghost">Composer à la carte</RouterLink>
        </div>
      </div>

      <template v-else>
        <ol class="stepper" aria-label="Étapes de la commande">
          <li :class="{ current: step === 1, done: step === 2 }" :aria-current="step === 1 ? 'step' : undefined">
            <span class="step-number">1</span> Mon panier
          </li>
          <li :class="{ current: step === 2 }" :aria-current="step === 2 ? 'step' : undefined">
            <span class="step-number">2</span> Mes coordonnées
          </li>
        </ol>

        <!-- Étape 1 : panier, code promo, total -->
        <div v-if="step === 1" class="cart-step">
          <div class="cart-list">
            <h2>Mes articles</h2>
            <div v-for="item in cart.items.value" :key="`${item.type}:${item.slug}`" class="cart-row">
              <div>
                <strong>{{ item.name }}</strong>
                <span class="cart-row-price">{{ item.price }} € / {{ item.unit || "unité" }}</span>
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
                <button type="button" class="link-btn" :aria-label="`Retirer ${item.name} du panier`" @click="cart.removeItem(item.type, item.slug)">
                  Retirer
                </button>
              </div>
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

            <button type="button" class="btn primary continue-btn" @click="goToStep(2)">Continuer →</button>

            <a :href="whatsappCartLink(cart.items.value)" target="_blank" rel="noreferrer" class="whatsapp-alt">
              Préférer commander ce panier sur WhatsApp
            </a>
          </div>
        </div>

        <!-- Étape 2 : coordonnées + récapitulatif -->
        <div v-else class="checkout-grid">
          <form class="order-form" novalidate @submit.prevent="submitOrder">
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
              <button type="submit" class="btn primary" :disabled="status === 'sending'">
                {{ status === "sending" ? "Envoi en cours…" : "Envoyer ma commande" }}
              </button>
            </div>
          </form>

          <aside class="recap" aria-label="Récapitulatif de la commande">
            <h2>Récapitulatif</h2>
            <ul>
              <li v-for="item in cart.items.value" :key="`${item.type}:${item.slug}`">
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
            <p class="recap-note">Le paiement se fait à la remise de votre commande.</p>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
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
  background: var(--green);
  color: #fff;
}

.stepper li.done {
  color: var(--green-dark);
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
.recap {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.cart-list h2,
.order-form h2,
.recap h2 {
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

.recap-note {
  margin: 14px 0 0;
  font-size: 12px;
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
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  gap: 12px;
  flex-wrap: wrap;
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
  color: var(--green-dark);
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
  color: var(--green-dark);
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
  border-color: #a3372e;
  background: #fdf5f4;
}

.field-error {
  margin: 0;
  font-size: 12px;
  color: #a3372e;
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
  color: #a3372e;
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
