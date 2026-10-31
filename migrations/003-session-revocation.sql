-- Incrémenter token_version invalide toutes les sessions JWT existantes du compte.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
