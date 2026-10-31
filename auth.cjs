const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.warn("[auth] JWT_SECRET non défini — utilisation d'un secret de développement, à corriger avant usage réel.");
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function setAuthCookie(res, name, token) {
  const parts = [
    `${name}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${30 * 24 * 60 * 60}`
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function clearAuthCookie(res, name) {
  res.append("Set-Cookie", `${name}=; Path=/; HttpOnly; Max-Age=0`);
}

function requireRole(role) {
  return (req, res, next) => {
    const token = req.cookies?.[role === "admin" ? "admin_token" : "customer_token"];
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.role !== role) {
      res.status(401).json({ ok: false, error: "Non authentifié." });
      return;
    }
    req.auth = payload;
    next();
  };
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie, requireRole };
