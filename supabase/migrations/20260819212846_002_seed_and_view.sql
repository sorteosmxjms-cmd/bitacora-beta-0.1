/*
# Seed initial products and a view for debt balances

1. Seed data
- Products: Chip Telcel, Chip AT&T, Chip Unefon ($110 each), Cargadores ($150), Auriculares ($0), Teléfonos básicos ($0), Teléfonos Android ($0).
- No personas seeded initially — the user will provide their apodo list. The UI supports adding personas on the fly from the VENTAS form.

2. New View
- `vista_saldos` — per-persona debt summary: total vendido, total abonado, saldo = vendido - abonado.
  Only includes personas that appear as persona_paga_id in ventas.

3. Notes
- Uses ON CONFLICT so re-running is safe.
*/

INSERT INTO productos (nombre, categoria, precio) VALUES
  ('Chip Telcel', 'chip', 110),
  ('Chip AT&T', 'chip', 110),
  ('Chip Unefon', 'chip', 110),
  ('Cargador', 'accesorio', 150),
  ('Auriculares', 'accesorio', 0),
  ('Teléfono básico', 'telefono', 0),
  ('Teléfono Android', 'telefono', 0)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW vista_saldos AS
SELECT
  p.id AS persona_id,
  p.apodo,
  COALESCE(SUM(v.total), 0) AS total_vendido,
  COALESCE((SELECT SUM(pg.cantidad) FROM pagos pg WHERE pg.persona_id = p.id), 0) AS total_abonado,
  COALESCE(SUM(v.total), 0) - COALESCE((SELECT SUM(pg.cantidad) FROM pagos pg WHERE pg.persona_id = p.id), 0) AS saldo
FROM personas p
LEFT JOIN ventas v ON v.persona_paga_id = p.id
GROUP BY p.id, p.apodo;

GRANT SELECT ON vista_saldos TO anon, authenticated;
