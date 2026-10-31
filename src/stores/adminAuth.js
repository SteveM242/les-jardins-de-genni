import { reactive } from "vue";
import { api } from "../api.js";

const state = reactive({
  admin: null,
  loaded: false
});

async function fetchMe() {
  const res = await api("/api/admin/me");
  state.admin = res.data?.admin || null;
  state.loaded = true;
  return state.admin;
}

async function login({ email, password }) {
  const res = await api("/api/admin/login", { method: "POST", body: { email, password } });
  if (!res.ok) throw new Error(res.error || "Connexion impossible.");
  state.admin = res.data.admin;
  return state.admin;
}

async function logout() {
  await api("/api/admin/logout", { method: "POST" });
  state.admin = null;
}

// Déconnecte tous les appareils (téléphone perdu, session oubliée…).
async function logoutEverywhere() {
  const res = await api("/api/admin/logout-all", { method: "POST" });
  if (res.ok) state.admin = null;
  return res.ok;
}

export function useAdminAuth() {
  return { state, fetchMe, login, logout, logoutEverywhere };
}
