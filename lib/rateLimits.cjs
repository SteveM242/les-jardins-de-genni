const { rateLimit } = require("express-rate-limit");

function limiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: message }
  });
}

const MINUTE = 60 * 1000;

module.exports = {
  // Filet de sécurité global sur toute l'API.
  api: limiter({ windowMs: MINUTE, limit: 300, message: "Trop de requêtes, réessayez dans un instant." }),
  // Seules les tentatives échouées comptent : un vrai utilisateur n'est jamais bloqué.
  login: limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes."
  }),
  forgot: limiter({ windowMs: 60 * MINUTE, limit: 5, message: "Trop de demandes de réinitialisation. Réessayez dans une heure." }),
  reset: limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    skipSuccessfulRequests: true,
    message: "Trop de tentatives. Réessayez dans 15 minutes."
  }),
  signup: limiter({ windowMs: 60 * MINUTE, limit: 10, message: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard." }),
  orders: limiter({ windowMs: 60 * MINUTE, limit: 20, message: "Trop de commandes envoyées. Réessayez plus tard ou contactez-nous par WhatsApp." }),
  discounts: limiter({ windowMs: 10 * MINUTE, limit: 30, message: "Trop de codes essayés. Réessayez dans quelques minutes." })
};
