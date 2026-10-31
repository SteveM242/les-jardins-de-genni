import { reactive } from "vue";

const state = reactive({
  admin: null,
  loaded: false
});

async function fetchMe() {
  const res = await fetch("/api/admin/me");
  const data = await res.json();
  state.admin = data.admin || null;
  state.loaded = true;
  return state.admin;
}

async function login({ email, password }) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Connexion impossible.");
  state.admin = data.admin;
  return data.admin;
}

async function logout() {
  await fetch("/api/admin/logout", { method: "POST" });
  state.admin = null;
}

export function useAdminAuth() {
  return { state, fetchMe, login, logout };
}
