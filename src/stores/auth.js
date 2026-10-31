import { reactive } from "vue";

const state = reactive({
  customer: null,
  loaded: false
});

async function fetchMe() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  state.customer = data.customer || null;
  state.loaded = true;
  return state.customer;
}

async function signup({ name, email, phone, password }) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, password })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Inscription impossible.");
  state.customer = data.customer;
  return data.customer;
}

async function login({ email, password }) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || "Connexion impossible.");
  state.customer = data.customer;
  return data.customer;
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  state.customer = null;
}

export function useAuth() {
  return { state, fetchMe, signup, login, logout };
}
