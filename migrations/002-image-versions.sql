-- Sert à versionner l'URL des images servies depuis la base (cache HTTP long).
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE baskets ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
