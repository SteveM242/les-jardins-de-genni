const jwt = require("jsonwebtoken");
const { query } = require("./db.cjs");

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET && isProduction) {
  // Un secret par défaut public permettrait de forger des sessions admin : on refuse de démarrer.
  console.error("[auth] JWT_SECRET non défini en production — arrêt du serveur.");
  process.exit(1);
}

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

const DAY_SECONDS = 24 * 60 * 60;
const SESSION_SECONDS = {
  admin: 7 * DAY_SECONDS,
  customer: 30 * DAY_SECONDS
};

const COOKIE_NAMES = { admin: "admin_token", customer: "customer_token" };
const ACCOUNT_TABLES = { admin: "admins", customer: "customers" };

function signToken(payload) {
  const seconds = SESSION_SECONDS[payload.role] || SESSION_SECONDS.customer;
  return jwt.sign(payload, SECRET, { expiresIn: seconds });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function cookieAttributes(maxAge) {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

function setAuthCookie(res, role, token) {
  res.append("Set-Cookie", `${COOKIE_NAMES[role]}=${token}; ${cookieAttributes(SESSION_SECONDS[role])}`);
}

function clearAuthCookie(res, role) {
  res.append("Set-Cookie", `${COOKIE_NAMES[role]}=; ${cookieAttributes(0)}`);
}

// Crée la session d'un compte : le token embarque la version courante, ce qui
// permet de le révoquer en incrémentant token_version côté base.
function startSession(res, role, account) {
  const token = signToken({ sub: account.id, role, v: account.token_version || 0 });
  setAuthCookie(res, role, token);
}

// Retourne le payload du cookie s'il est valide ET non révoqué, sinon null.
async function readSession(req, role) {
  const token = req.cookies?.[COOKIE_NAMES[role]];
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== role) return null;
  const { rows } = await query(`SELECT token_version FROM ${ACCOUNT_TABLES[role]} WHERE id = $1`, [payload.sub]);
  if (!rows[0] || rows[0].token_version !== (payload.v || 0)) return null;
  return payload;
}

async function revokeSessions(role, accountId) {
  await query(`UPDATE ${ACCOUNT_TABLES[role]} SET token_version = token_version + 1 WHERE id = $1`, [accountId]);
}

function requireRole(role) {
  return async (req, res, next) => {
    try {
      const payload = await readSession(req, role);
      if (!payload) {
        res.status(401).json({ ok: false, error: "Non authentifié." });
        return;
      }
      req.auth = payload;
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function attachCustomer(req, _res, next) {
  try {
    req.customer = await readSession(req, "customer");
    next();
  } catch (err) {
    next(err);
  }
}

// Défense CSRF en complément de SameSite=Lax : une requête qui modifie des
// données doit provenir de notre propre origine (si le navigateur envoie Origin).
function requireSameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ ok: false, error: "Origine refusée." });
  }
  const allowedHosts = [req.get("host"), req.get("x-forwarded-host")].filter(Boolean);
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).host;
      } catch {
        return value;
      }
    });
  if ([...allowedHosts, ...extra].includes(originHost)) return next();
  res.status(403).json({ ok: false, error: "Origine refusée." });
}

module.exports = {
  signToken,
  verifyToken,
  startSession,
  clearAuthCookie,
  readSession,
  revokeSessions,
  requireRole,
  attachCustomer,
  requireSameOrigin
};
