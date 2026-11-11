-- Stock par article (NULL = illimité), suivi des messages « commande prête » et des rappels de retrait,
-- paiement en ligne, adresses et favoris des clients.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER CHECK (stock IS NULL OR stock >= 0);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_reminded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'retrait';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS addresses JSONB NOT NULL DEFAULT '[]';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorites JSONB NOT NULL DEFAULT '[]';
