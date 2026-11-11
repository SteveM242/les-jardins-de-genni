-- Exemple de panier personnalisable (16 articles, prix fixe, remplacements et doubles).
-- Créé HORS VENTE (active = false) : relire le contenu et le prix dans l'espace pro › Paniers, puis le mettre en vente.
-- N'écrase rien si un panier du même nom existe déjà.
INSERT INTO baskets (slug, name, icon, price, summary, details, origin, item_count, items, active, composition)
VALUES (
  'panier-familial',
  'Panier Familial',
  '🧺',
  34.00,
  '16 fruits et légumes péyi pour la famille, que vous pouvez composer à votre goût.',
  'Remplacez un article par un autre ou prenez-en en double, sans changer le prix, dans la limite de 16 articles.',
  'Martinique',
  16,
  '["Bananes","Tomates","Concombres","Salade","Carottes","Christophines","Citrons verts","Ananas"]'::jsonb,
  false,
  '{"maxItems":16,"requireFull":true,"entries":[
    {"name":"Bananes","qty":3,"max":6,"kind":"base","note":"environ 1 kg"},
    {"name":"Tomates","qty":3,"max":6,"kind":"base","note":"500 g"},
    {"name":"Concombres","qty":2,"max":4,"kind":"base","note":""},
    {"name":"Salade","qty":2,"max":4,"kind":"base","note":"1 pied"},
    {"name":"Carottes","qty":2,"max":4,"kind":"base","note":"500 g"},
    {"name":"Christophines","qty":2,"max":4,"kind":"base","note":""},
    {"name":"Citrons verts","qty":1,"max":3,"kind":"base","note":"1 sachet"},
    {"name":"Ananas","qty":1,"max":2,"kind":"base","note":"1 pièce"},
    {"name":"Poivrons","qty":0,"max":3,"kind":"replacement","note":""},
    {"name":"Aubergines","qty":0,"max":3,"kind":"replacement","note":""},
    {"name":"Giraumon","qty":0,"max":2,"kind":"replacement","note":"1 tranche"},
    {"name":"Patates douces","qty":0,"max":3,"kind":"replacement","note":"500 g"},
    {"name":"Papaye","qty":0,"max":2,"kind":"replacement","note":""},
    {"name":"Cive et persil","qty":0,"max":2,"kind":"replacement","note":"1 botte"}
  ]}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
