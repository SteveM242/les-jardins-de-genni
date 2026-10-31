-- Les photos de démonstration sont désormais servies en WebP (public/images/*.webp).
UPDATE baskets SET image = replace(image, '.jpg', '.webp') WHERE image LIKE '/images/%.jpg';
UPDATE products SET image = replace(image, '.jpg', '.webp') WHERE image LIKE '/images/%.jpg';
