-- Migración: agrega descripción, cobro recurrente y datos del aval al contrato.
-- Ejecutar una sola vez contra la base de datos existente (create_all no altera tablas ya creadas).
-- Ejemplo: psql "$DATABASE_URL" -f migracion_contrato_aval.sql

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS descripcion TEXT;

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cobro_recurrente BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS dia_cobro INTEGER NOT NULL DEFAULT 1;

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_nombre VARCHAR(150);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_calle VARCHAR(150);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_numero VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_colonia VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_ciudad VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_estado VARCHAR(100);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_cp VARCHAR(10);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_no_predial VARCHAR(50);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_email VARCHAR(150);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_telefono_casa VARCHAR(20);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS aval_telefono_celular VARCHAR(20);

-- Estado del inquilino (vigente / baja)
ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS estado VARCHAR(10) NOT NULL DEFAULT 'vigente';
