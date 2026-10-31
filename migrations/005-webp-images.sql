-- Les photos de démonstration sont désormais servies en WebP (public/images/*.webp).
UPDATE baskets SET image = regexp_replace(image, '^/images/([a-z0-9-]+)\.jpg$', '/images/\1.webp') WHERE image ~ '^/images/[a-z0-9-]+\.jpg$';
UPDATE products SET image = regexp_replace(image, '^/images/([a-z0-9-]+)\.jpg$', '/images/\1.webp') WHERE image ~ '^/images/[a-z0-9-]+\.jpg$';
