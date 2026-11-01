-- Un email n'est "vérifié" qu'après clic sur un lien reçu dans la boîte mail (ou réinitialisation de mot de passe).
-- Seuls les comptes vérifiés peuvent récupérer automatiquement les commandes passées sans compte avec leur email.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verifications (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_customer_idx ON email_verifications (customer_id);
