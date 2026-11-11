-- Paiement suivi à la commande, ruptures de stock de la semaine, rappels avant la clôture de la vente.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS orders_desired_date_idx ON orders (desired_date);

ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS reminder_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
