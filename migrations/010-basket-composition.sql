-- Paniers personnalisables : le client remplace ou double des articles, à prix fixe, dans la limite
-- d'un nombre total d'articles. NULL = panier classique (contenu figé, colonne items).
-- Forme : { "maxItems": 16, "entries": [{ "name", "qty", "max", "kind": "base"|"replacement", "note" }] }
ALTER TABLE baskets ADD COLUMN IF NOT EXISTS composition JSONB;
