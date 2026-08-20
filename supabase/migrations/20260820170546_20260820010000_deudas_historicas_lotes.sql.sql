-- Create lotes_importacion table for tracking bulk import batches
CREATE TABLE IF NOT EXISTS lotes_importacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  registros int NOT NULL DEFAULT 0,
  total_importado numeric NOT NULL DEFAULT 0,
  nota text
);

ALTER TABLE lotes_importacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lotes" ON lotes_importacion;
CREATE POLICY "anon_select_lotes" ON lotes_importacion FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lotes" ON lotes_importacion;
CREATE POLICY "anon_insert_lotes" ON lotes_importacion FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lotes" ON lotes_importacion;
CREATE POLICY "anon_delete_lotes" ON lotes_importacion FOR DELETE TO anon, authenticated USING (true);

-- Add new columns to ventas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'venta';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS nota text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES lotes_importacion(id) ON DELETE SET NULL;

-- Add UPDATE and DELETE policies to pagos (for editing/deleting abonos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pagos' AND policyname = 'anon_update_pagos') THEN
    CREATE POLICY "anon_update_pagos" ON pagos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pagos' AND policyname = 'anon_delete_pagos') THEN
    CREATE POLICY "anon_delete_pagos" ON pagos FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ventas_lote ON ventas(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_origen ON ventas(origen);

-- Helper productos for historical imports
INSERT INTO productos (nombre, categoria, precio, activo)
SELECT 'Chip histórico', 'chip', 0, true
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Chip histórico');

INSERT INTO productos (nombre, categoria, precio, activo)
SELECT 'Deuda histórica (manual)', 'accesorio', 0, true
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Deuda histórica (manual)');
