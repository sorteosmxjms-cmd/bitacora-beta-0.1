-- Fix: chips should cascade-delete when their parent venta is deleted.
-- The app's eliminarVenta assumes CASCADE but the schema had RESTRICT,
-- which blocked every delete of a chip sale.

ALTER TABLE chips
  DROP CONSTRAINT IF EXISTS chips_venta_id_fkey;

ALTER TABLE chips
  ADD CONSTRAINT chips_venta_id_fkey
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE;
