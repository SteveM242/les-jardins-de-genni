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

async function signup({ name, email, phone, password }) {
  const res = await api("/api/auth/signup", { method: "POST", body: { name, email, phone, password } });
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

async function updateProfile({ name, phone, address }) {
  const res = await api("/api/account", { method: "PATCH", body: { name, phone, address } });
  if (!res.ok) throw new Error(res.error || "Enregistrement impossible.");
  state.customer = res.data.customer;
  return state.customer;
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
    verifyEmail,
    resendVerification,
    claimOrder
  };
}
