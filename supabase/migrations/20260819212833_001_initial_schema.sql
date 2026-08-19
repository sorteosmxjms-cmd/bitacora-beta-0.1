/*
# Initial schema for chip sales business management system

Single-tenant app (no sign-in). All tables use open anon/authenticated policies
because the data is intentionally shared within the business.

1. New Tables
- `personas` — people who use and/or pay for chips and products
  - id (uuid PK), apodo (text, unique), activo (bool default true), creado_en (timestamptz)
- `productos` — catalog of products sold
  - id (uuid PK), nombre (text), categoria (text), precio (numeric), activo (bool default true)
  - For chips, precio is the default chip price; company-specific (all same $110 for now)
- `ventas` — every sale (chip or product)
  - id (uuid PK), fecha (timestamptz default now()),
  - producto_id (uuid FK -> productos),
  - persona_usa_id (uuid FK -> personas, nullable),
  - persona_paga_id (uuid FK -> personas, nullable),
  - cantidad (int default 1),
  - precio_unitario (numeric) — captured at sale time so historical sales don't change,
  - total (numeric) — cantidad * precio_unitario,
  - estado_pago (text: pendiente/abonado/liquidado, default pendiente)
- `chips` — chip-specific info linked to a venta
  - id (uuid PK),
  - venta_id (uuid FK -> ventas ON DELETE RESTRICT),
  - numero (text, 10 digits),
  - compania (text: telcel/att/unefon),
  - ultimos4 (text, 4 digits),
  - estado_chip (text: en_uso/baja, default en_uso)
- `pagos` — payments/abonos made by a person against their debt
  - id (uuid PK), persona_id (uuid FK -> personas), cantidad (numeric), fecha (timestamptz default now()), nota (text)

2. Security
- RLS enabled on all tables.
- Open CRUD for anon + authenticated (single-tenant, shared business data).

3. Notes
- estado_pago on ventas is denormalized for quick display but recomputed from pagos.
  The actual source of truth for balances is: sum(ventas.total where persona_paga_id = X)
  minus sum(pagos.cantidad where persona_id = X).
- Chips link to ventas so chip info and sale info stay connected but separable.
*/

CREATE TABLE IF NOT EXISTS personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apodo text UNIQUE NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_personas" ON personas;
CREATE POLICY "anon_select_personas" ON personas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_personas" ON personas;
CREATE POLICY "anon_insert_personas" ON personas FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_personas" ON personas;
CREATE POLICY "anon_update_personas" ON personas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_personas" ON personas;
CREATE POLICY "anon_delete_personas" ON personas FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'accesorio',
  precio numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_productos" ON productos;
CREATE POLICY "anon_select_productos" ON productos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_productos" ON productos;
CREATE POLICY "anon_insert_productos" ON productos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_productos" ON productos;
CREATE POLICY "anon_update_productos" ON productos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_productos" ON productos;
CREATE POLICY "anon_delete_productos" ON productos FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  persona_usa_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  persona_paga_id uuid REFERENCES personas(id) ON DELETE SET NULL,
  cantidad int NOT NULL DEFAULT 1,
  precio_unitario numeric NOT NULL,
  total numeric NOT NULL,
  estado_pago text NOT NULL DEFAULT 'pendiente'
);

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_ventas" ON ventas;
CREATE POLICY "anon_select_ventas" ON ventas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ventas" ON ventas;
CREATE POLICY "anon_insert_ventas" ON ventas FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ventas" ON ventas;
CREATE POLICY "anon_update_ventas" ON ventas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ventas" ON ventas;
CREATE POLICY "anon_delete_ventas" ON ventas FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS chips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  compania text NOT NULL,
  ultimos4 text NOT NULL,
  estado_chip text NOT NULL DEFAULT 'en_uso',
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_chips" ON chips;
CREATE POLICY "anon_select_chips" ON chips FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_chips" ON chips;
CREATE POLICY "anon_insert_chips" ON chips FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_chips" ON chips;
CREATE POLICY "anon_update_chips" ON chips FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_chips" ON chips;
CREATE POLICY "anon_delete_chips" ON chips FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  cantidad numeric NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  nota text
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_pagos" ON pagos;
CREATE POLICY "anon_select_pagos" ON pagos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pagos" ON pagos;
CREATE POLICY "anon_insert_pagos" ON pagos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pagos" ON pagos;
CREATE POLICY "anon_update_pagos" ON pagos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pagos" ON pagos;
CREATE POLICY "anon_delete_pagos" ON pagos FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ventas_paga ON ventas(persona_paga_id);
CREATE INDEX IF NOT EXISTS idx_ventas_usa ON ventas(persona_usa_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_chips_venta ON chips(venta_id);
CREATE INDEX IF NOT EXISTS idx_chips_numero ON chips(numero);
CREATE INDEX IF NOT EXISTS idx_chips_ultimos4 ON chips(ultimos4);
CREATE INDEX IF NOT EXISTS idx_chips_compania ON chips(compania);
CREATE INDEX IF NOT EXISTS idx_pagos_persona ON pagos(persona_id);
CREATE INDEX IF NOT EXISTS idx_personas_apodo_lower ON personas (lower(apodo));
