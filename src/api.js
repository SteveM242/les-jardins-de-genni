const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau et réessayez.";

// Appel JSON vers l'API : ne lève jamais d'exception, renvoie { ok, status, data, error }.
// `error` est un message prêt à afficher (celui du serveur si disponible).
export async function api(path, { method = "GET", body, formData } = {}) {
  const options = { method, headers: {} };
  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, options);
  } catch {
    return { ok: false, status: 0, data: null, error: NETWORK_ERROR };
  }

  const data = await res.json().catch(() => null);
  const ok = res.ok && data?.ok !== false;

  // Session admin expirée ou révoquée : retour à l'écran de connexion.
  const isAdminCall = path.startsWith("/api/admin/") && !path.startsWith("/api/admin/login") && path !== "/api/admin/me";
  if (res.status === 401 && isAdminCall && typeof window !== "undefined") {
    window.location.assign("/admin/connexion");
  }

  return {
    ok,
    status: res.status,
    data,
    error: ok ? "" : data?.error || "Une erreur est survenue. Réessayez dans un instant."
  };
}
