-- Jour de retrait / livraison souhaité par le client (facultatif, indicatif).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS desired_date DATE;
