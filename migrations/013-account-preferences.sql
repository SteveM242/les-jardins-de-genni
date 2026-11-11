-- Mode de réception préféré du client (pré-sélectionné au checkout).
ALTER TABLE customers ADD COLUMN IF NOT EXISTS default_fulfillment TEXT NOT NULL DEFAULT 'retrait';
