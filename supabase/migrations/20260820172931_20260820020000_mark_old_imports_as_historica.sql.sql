-- Mark old bad imports as origen='historica' so they can be identified for cleanup
-- These are ventas with "(importado)" products that were created by the old broken importer
-- Real ventas use products like "Chip Telcel", "Cargador" (without "(importado)" suffix)
UPDATE ventas
SET origen = 'historica'
WHERE producto_id IN (
  SELECT id FROM productos WHERE nombre LIKE '%(importado)%'
);

-- Add a DELETE policy on ventas for anon/authenticated if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ventas' AND policyname = 'anon_delete_ventas') THEN
    CREATE POLICY "anon_delete_ventas" ON ventas FOR DELETE TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ventas' AND policyname = 'anon_update_ventas') THEN
    CREATE POLICY "anon_update_ventas" ON ventas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
