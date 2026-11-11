import { reactive } from "vue";
import { api } from "../api.js";

const state = reactive({
  customer: null,
  loaded: false
});

async function fetchMe() {
  const res = await api("/api/auth/me");
  state.customer = res.data?.customer || null;
  state.loaded = true;
  return state.customer;
}

async function signup({ name, email, phone, address, password, acceptTerms }) {
  const res = await api("/api/auth/signup", { method: "POST", body: { name, email, phone, address, password, acceptTerms } });
  if (!res.ok) throw new Error(res.error || "Inscription impossible.");
  state.customer = res.data.customer;
  return { customer: state.customer, verificationEmailSent: Boolean(res.data.verificationEmailSent) };
}

async function login({ email, password }) {
  const res = await api("/api/auth/login", { method: "POST", body: { email, password } });
  if (!res.ok) throw new Error(res.error || "Connexion impossible.");
  state.customer = res.data.customer;
  return state.customer;
}

// defaultFulfillment ("retrait" | "livraison") et reminder (rappel du lundi) sont facultatifs.
async function updateProfile({ name, phone, address, defaultFulfillment, reminder }) {
  const res = await api("/api/account", { method: "PATCH", body: { name, phone, address, defaultFulfillment, reminder } });
  if (!res.ok) throw new Error(res.error || "Enregistrement impossible.");
  state.customer = res.data.customer;
  return state.customer;
}

// Changer d'email : la nouvelle adresse doit être confirmée par un lien.
async function changeEmail({ email, currentPassword }) {
  const res = await api("/api/account/email", { method: "PATCH", body: { email, currentPassword } });
  if (!res.ok) throw new Error(res.error || "Changement impossible.");
  state.customer = res.data.customer;
  return { verificationEmailSent: Boolean(res.data.verificationEmailSent) };
}

async function deleteAccount({ currentPassword, eraseOrders }) {
  const res = await api("/api/account", { method: "DELETE", body: { currentPassword, eraseOrders } });
  if (!res.ok) throw new Error(res.error || "Suppression impossible.");
  state.customer = null;
}

async function changePassword({ currentPassword, newPassword }) {
  const res = await api("/api/account/password", { method: "POST", body: { currentPassword, newPassword } });
  if (!res.ok) throw new Error(res.error || "Changement impossible.");
}

// Les trois appels suivants renvoient le résultat brut de api() : l'écran décide quoi afficher.
async function verifyEmail(token) {
  const res = await api("/api/auth/verify", { method: "POST", body: { token } });
  if (res.ok && state.customer) await fetchMe();
  return res;
}

function resendVerification() {
  return api("/api/account/resend-verification", { method: "POST" });
}

function claimOrder({ orderNumber, phone }) {
  return api("/api/account/claim-order", { method: "POST", body: { orderNumber, phone } });
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  state.customer = null;
}

export function useAuth() {
  return {
    state,
    fetchMe,
    signup,
    login,
    logout,
    updateProfile,
    changePassword,
    changeEmail,
    deleteAccount,
    verifyEmail,
    resendVerification,
    claimOrder
  };
}
