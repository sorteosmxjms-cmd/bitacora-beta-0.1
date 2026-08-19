-- Make the venta->chip relationship one-to-one.
-- PostgREST returns to-one relations as a single object and to-many as an array.
-- Without this unique constraint, chips come back as `chip: [{...}]` (array)
-- and the frontend reads `chip.numero` → undefined, so the number never shows.
ALTER TABLE chips
  ADD CONSTRAINT chips_venta_id_unique UNIQUE (venta_id);
