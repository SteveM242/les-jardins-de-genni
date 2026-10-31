<script setup>
import { reactive, ref, onMounted, computed } from "vue";
import { RouterLink } from "vue-router";
import { useCart } from "../stores/cart.js";
import { useAuth } from "../stores/auth.js";
import { whatsappCartLink } from "../data/site.js";

const cart = useCart();
const auth = useAuth();

const form = reactive({
  name: "",
  phone: "",
  email: "",
  fulfillment: "retrait",
  address: "",
  notes: "",
  website: "" // honeypot — doit rester vide
});

const status = ref("idle"); // idle | sending | success | error
const errorMessage = ref("");
const lastOrder = ref(null);

const discountInput = ref("");
const discount = ref(null); // { code, amount }
const discountError = ref("");
const discountChecking = ref(false);

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

async function applyDiscount() {
  discountError.value = "";
  discount.value = null;
  if (!discountInput.value.trim()) return;

  discountChecking.value = true;
  try {
    const res = await fetch("/api/discounts/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: discountInput.value, subtotal: cart.subtotal.value })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "Code invalide.");
    discount.value = { code: data.code, amount: data.amount };
  } catch (err) {
    discountError.value = err.message;
  } finally {
    discountChecking.value = false;
  }
}

async function submitOrder() {
  if (cart.items.value.length === 0) return;
  if (!form.name.trim() || !form.phone.trim()) {
    status.value = "error";
    errorMessage.value = "Merci de renseigner au moins votre nom et votre téléphone.";
    return;
  }

  status.value = "sending";
  errorMessage.value = "";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Impossible d'envoyer la commande.");
    }

    lastOrder.value = data;
    cart.clear();
    discount.value = null;
    discountInput.value = "";
    status.value = "success";
  } catch (err) {
    status.value = "error";
    errorMessage.value = err.message || "Une erreur est survenue. Réessayez ou passez par WhatsApp.";
  }
}
</script>

<template>
  <div class="checkout">
    <div class="container">
      <p class="eyebrow">Votre commande</p>
      <h1>Panier &amp; commande</h1>

      <div v-if="status === 'success'" class="success-box">
        <h2>Commande envoyée, merci {{ lastOrder?.customer?.name }} !</h2>
        <p>
          Numéro de commande : <strong>{{ lastOrder?.orderId }}</strong> — total {{ lastOrder?.total }} €.
          Genni va vous recontacter pour confirmer la disponibilité et le
          {{ form.fulfillment === "livraison" ? "créneau de livraison" : "retrait" }}.
        </p>
        <p v-if="!auth.state.customer" class="account-hint">
          <RouterLink to="/compte/inscription">Créez un compte</RouterLink> pour retrouver vos commandes la prochaine fois.
        </p>
        <RouterLink to="/" class="btn primary">Retour à l'accueil</RouterLink>
      </div>

      <div v-else-if="cart.items.value.length === 0" class="empty-box">
        <p>Votre panier est vide pour le moment.</p>
        <RouterLink to="/#paniers" class="btn primary">Voir les paniers</RouterLink>
      </div>

      <div v-else class="checkout-grid">
        <div class="cart-list">
          <h2>Mes articles</h2>
          <div v-for="item in cart.items.value" :key="`${item.type}:${item.slug}`" class="cart-row">
            <div>
              <strong>{{ item.name }}</strong>
              <span class="cart-row-price">{{ item.price }} € / {{ item.unit || "unité" }}</span>
            </div>
            <div class="cart-row-controls">
              <input
                type="number"
                min="1"
                max="20"
                :value="item.qty"
                @change="cart.setQty(item.type, item.slug, Number($event.target.value))"
              />
              <button type="button" class="link-btn" @click="cart.removeItem(item.type, item.slug)">Retirer</button>
            </div>
          </div>

          <div class="discount-box">
            <label>
              Code promo
              <div class="discount-input-row">
                <input v-model.trim="discountInput" type="text" placeholder="ex: BIENVENUE10" />
                <button type="button" class="btn ghost" :disabled="discountChecking" @click="applyDiscount">
                  {{ discountChecking ? "…" : "Appliquer" }}
                </button>
              </div>
            </label>
            <p v-if="discountError" class="form-error">{{ discountError }}</p>
            <p v-if="discount" class="discount-applied">Code {{ discount.code }} appliqué : -{{ discount.amount }} €</p>
          </div>

          <div class="cart-total">
            <span>Sous-total</span>
            <span>{{ cart.subtotal.value }} €</span>
          </div>
          <div v-if="discount" class="cart-total discount-line">
            <span>Réduction</span>
            <span>-{{ discount.amount }} €</span>
          </div>
          <div class="cart-total cart-total-final">
            <span>Total</span>
            <strong>{{ total }} €</strong>
          </div>

          <a :href="whatsappCartLink(cart.items.value)" target="_blank" rel="noreferrer" class="whatsapp-alt">
            Préférer commander ce panier sur WhatsApp
          </a>
        </div>

        <form class="order-form" @submit.prevent="submitOrder">
          <h2>Vos coordonnées</h2>
          <p v-if="!auth.state.customer" class="guest-note">
            Pas besoin de compte pour commander — remplissez simplement vos coordonnées ci-dessous.
          </p>

          <label>
            Nom et prénom *
            <input v-model.trim="form.name" type="text" required />
          </label>

          <label>
            Téléphone *
            <input v-model.trim="form.phone" type="tel" required />
          </label>

          <label>
            Email (optionnel, pour recevoir une confirmation)
            <input v-model.trim="form.email" type="email" />
          </label>

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

          <label v-if="form.fulfillment === 'livraison'">
            Adresse de livraison
            <textarea v-model.trim="form.address" rows="2"></textarea>
          </label>

          <label>
            Remarques (allergies, créneau préféré, etc.)
            <textarea v-model.trim="form.notes" rows="2"></textarea>
          </label>

          <input
            v-model="form.website"
            type="text"
            autocomplete="off"
            tabindex="-1"
            class="honeypot"
            aria-hidden="true"
          />

          <p v-if="status === 'error'" class="form-error">{{ errorMessage }}</p>

          <button type="submit" class="btn primary" :disabled="status === 'sending'">
            {{ status === "sending" ? "Envoi en cours…" : "Envoyer ma commande" }}
          </button>
        </form>
      </div>
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
  margin: 4px 0 32px;
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
  max-width: 480px;
  margin: 0 auto 24px;
}

.empty-box p {
  color: var(--muted);
  margin: 0 0 20px;
}

.checkout-grid {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 40px;
  align-items: start;
}

.cart-list,
.order-form {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 24px;
}

.cart-list h2,
.order-form h2 {
  font-size: 18px;
  margin: 0 0 18px;
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
}

.cart-row-price {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.cart-row-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cart-row-controls input {
  width: 60px;
  padding: 8px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  font: inherit;
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
  display: grid;
  gap: 6px;
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

.account-hint {
  font-size: 13px;
  color: var(--muted);
  margin: -8px 0 20px;
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

.order-form label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.order-form input[type="text"],
.order-form input[type="tel"],
.order-form input[type="email"],
.order-form textarea {
  font: inherit;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--line);
  color: var(--text);
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
  flex-direction: row;
  align-items: center;
  gap: 6px;
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

@media (max-width: 760px) {
  .checkout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
