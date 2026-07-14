-- HISTORICO - NO EJECUTAR.
-- La fuente vigente es apps/api/prisma/schema.prisma y prisma/migrations.
-- Este archivo se conserva unicamente para trazabilidad del modelo v0.2.

-- ============================================================================
-- COURIER SaaS - MODELO A+ (MVP v0.2)
-- Frontend: Next.js + React + TypeScript
-- Backend: NestJS + TypeScript + Prisma ORM
-- Base de datos: PostgreSQL 15+
-- Modelo: SaaS multi-tenant. Cada organization es un courier independiente.
-- Fecha de versión: 2026-06-23
--
-- Cambios v0.2:
--   * Servicios configurables por organization (tabla services).
--   * Tracking normalizado y carrier obligatorio; usar carrier UNKNOWN.
--   * organization_status es la única autoridad de activación del tenant.
--   * TAX y DISCOUNT salen de invoice_items; viven en la cabecera de factura.
--   * REFUNDED queda fuera del MVP inicial.
--   * Protección de invoice_items después de emitir la factura.
--   * Exclusión de tarifas solapadas mediante btree_gist.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE organization_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE measurement_system AS ENUM ('IMPERIAL', 'METRIC');
CREATE TYPE facility_type AS ENUM (
  'INTERNATIONAL_WAREHOUSE',
  'DISTRIBUTION_CENTER',
  'BRANCH',
  'AGENCY',
  'PICKUP_POINT',
  'OFFICE'
);
CREATE TYPE facility_ownership AS ENUM ('OWNED', 'AGENCY', 'PARTNER');
CREATE TYPE employee_role AS ENUM (
  'ORGANIZATION_OWNER',
  'ORGANIZATION_ADMIN',
  'OPERATIONS_MANAGER',
  'FACILITY_MANAGER',
  'RECEPTIONIST',
  'WAREHOUSE_CLERK',
  'CASHIER',
  'CUSTOMER_SERVICE'
);
CREATE TYPE package_status AS ENUM (
  'PRE_ALERTED',
  'RECEIVED',
  'IN_TRANSIT',
  'RECEIVED_AT_FACILITY',
  'AVAILABLE',
  'PICKED_UP',
  'HELD',
  'LOST',
  'RETURNED',
  'CANCELLED'
);
CREATE TYPE transfer_status AS ENUM (
  'PREPARING',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED',
  'COMPLETED',
  'DISCREPANCY',
  'CANCELLED'
);
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'CONFIRMED', 'VOIDED');
CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD_EXTERNAL', 'OTHER');
CREATE TYPE invoice_item_type AS ENUM (
  'FREIGHT',
  'SURCHARGE',
  'INSURANCE',
  'STORAGE',
  'CUSTOMS',
  'DELIVERY',
  'OTHER'
);
CREATE TYPE audit_action AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'LOGIN',
  'LOGOUT',
  'EXPORT'
);
CREATE TYPE document_type AS ENUM ('INVOICE', 'PACKAGE', 'TRANSFER');

-- ----------------------------------------------------------------------------
-- FUNCIONES COMUNES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The table % is append-only', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_tracking_value(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT upper(regexp_replace(btrim(p_value), E'\\s+', '', 'g'));
$$;

-- ----------------------------------------------------------------------------
-- 1. ORGANIZATIONS
-- Cada courier cliente del SaaS es un tenant independiente.
-- status es la única autoridad de habilitación del tenant.
-- ----------------------------------------------------------------------------
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(80) NOT NULL,
  commercial_name varchar(200) NOT NULL,
  legal_name varchar(250),
  tax_id varchar(50),
  email varchar(255),
  phone varchar(30),
  logo_url text,
  primary_color varchar(7),
  default_currency char(3) NOT NULL DEFAULT 'DOP',
  measurement_system measurement_system NOT NULL DEFAULT 'IMPERIAL',
  volumetric_divisor integer NOT NULL DEFAULT 166,
  mailbox_prefix varchar(20) NOT NULL DEFAULT 'BOX',
  invoice_prefix varchar(20) NOT NULL DEFAULT 'INV',
  package_prefix varchar(20) NOT NULL DEFAULT 'PKG',
  transfer_prefix varchar(20) NOT NULL DEFAULT 'TRF',
  timezone varchar(60) NOT NULL DEFAULT 'America/Santo_Domingo',
  plan_code varchar(40) NOT NULL DEFAULT 'STARTER',
  status organization_status NOT NULL DEFAULT 'TRIAL',
  trial_ends_at timestamptz,
  max_users integer NOT NULL DEFAULT 5,
  max_facilities integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT organizations_currency_chk CHECK (default_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT organizations_color_chk CHECK (
    primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT organizations_volumetric_divisor_chk CHECK (volumetric_divisor > 0),
  CONSTRAINT organizations_limits_chk CHECK (max_users > 0 AND max_facilities > 0)
);
CREATE UNIQUE INDEX uq_organizations_slug_lower ON organizations (lower(slug));

-- ----------------------------------------------------------------------------
-- 2. FACILITIES
-- ----------------------------------------------------------------------------
CREATE TABLE facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(30) NOT NULL,
  name varchar(160) NOT NULL,
  facility_type facility_type NOT NULL,
  ownership_type facility_ownership NOT NULL DEFAULT 'OWNED',
  address_line1 varchar(300) NOT NULL,
  address_line2 varchar(300),
  city varchar(100) NOT NULL,
  province_state varchar(100),
  postal_code varchar(20),
  country_code char(2) NOT NULL DEFAULT 'DO',
  phone varchar(30),
  email varchar(255),
  is_customer_facing boolean NOT NULL DEFAULT true,
  can_receive_packages boolean NOT NULL DEFAULT true,
  can_dispatch_packages boolean NOT NULL DEFAULT true,
  is_hub boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, name),
  UNIQUE (organization_id, id),
  CONSTRAINT facilities_country_chk CHECK (country_code ~ '^[A-Z]{2}$')
);

-- ----------------------------------------------------------------------------
-- 3. USERS Y SESIONES
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  display_name varchar(150) NOT NULL,
  phone varchar(30),
  is_platform_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id),
  refresh_token_hash varchar(255) NOT NULL,
  token_family uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address inet,
  user_agent varchar(500),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT user_sessions_expiry_chk CHECK (expires_at > created_at),
  CONSTRAINT user_sessions_revocation_chk CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);
CREATE UNIQUE INDEX uq_user_sessions_refresh_hash ON user_sessions (refresh_token_hash);
CREATE INDEX idx_user_sessions_user_active
  ON user_sessions (user_id, organization_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_user_sessions_token_family
  ON user_sessions (token_family)
  WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. EMPLOYEES Y ASIGNACIONES
-- ----------------------------------------------------------------------------
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role employee_role NOT NULL,
  employee_code varchar(40),
  is_active boolean NOT NULL DEFAULT true,
  hired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, employee_code),
  UNIQUE (organization_id, id)
);

CREATE TABLE employee_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, facility_id),
  FOREIGN KEY (organization_id, employee_id)
    REFERENCES employees(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id)
);
CREATE UNIQUE INDEX uq_employee_primary_facility
  ON employee_facilities (organization_id, employee_id)
  WHERE is_primary = true;

-- ----------------------------------------------------------------------------
-- 5. CUSTOMERS
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  home_facility_id uuid NOT NULL,
  mailbox_code varchar(30) NOT NULL,
  full_name varchar(180) NOT NULL,
  email varchar(255),
  phone varchar(30),
  id_document varchar(50),
  address_line1 varchar(300),
  address_line2 varchar(300),
  city varchar(100),
  province_state varchar(100),
  postal_code varchar(20),
  country_code char(2) NOT NULL DEFAULT 'DO',
  privacy_consent_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, mailbox_code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, home_facility_id)
    REFERENCES facilities(organization_id, id),
  CONSTRAINT customers_country_chk CHECK (country_code ~ '^[A-Z]{2}$')
);
CREATE UNIQUE INDEX uq_customers_user_per_org
  ON customers (organization_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_customers_home_facility
  ON customers (organization_id, home_facility_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. STORAGE LOCATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  facility_id uuid NOT NULL,
  code varchar(50) NOT NULL,
  description varchar(160),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, facility_id, code),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, facility_id, id),
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id)
);

-- ----------------------------------------------------------------------------
-- 7. CARRIERS
-- carrier_id es obligatorio en packages. Si se desconoce, usar un registro
-- por organization con is_unknown = true y code = 'UNKNOWN'.
-- ----------------------------------------------------------------------------
CREATE TABLE carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(40) NOT NULL,
  name varchar(120) NOT NULL,
  tracking_url_template text,
  is_unknown boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id),
  CONSTRAINT carriers_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  CONSTRAINT carriers_unknown_code_chk CHECK (
    is_unknown = false OR code = 'UNKNOWN'
  )
);
CREATE UNIQUE INDEX uq_carriers_name_lower ON carriers (organization_id, lower(name));
CREATE UNIQUE INDEX uq_carriers_unknown_per_org
  ON carriers (organization_id)
  WHERE is_unknown = true;

-- ----------------------------------------------------------------------------
-- 8. SERVICES
-- Catálogo configurable por courier; evita enums rígidos.
-- ----------------------------------------------------------------------------
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code varchar(40) NOT NULL,
  name varchar(120) NOT NULL,
  description text,
  transport_mode varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id),
  CONSTRAINT services_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  CONSTRAINT services_transport_mode_chk CHECK (
    transport_mode IN ('AIR', 'SEA', 'GROUND', 'LOCAL', 'OTHER')
  )
);
CREATE UNIQUE INDEX uq_services_name_lower ON services (organization_id, lower(name));

-- ----------------------------------------------------------------------------
-- 9. PACKAGES
-- IMPERIAL = peso en lb y dimensiones en in.
-- METRIC   = peso en kg y dimensiones en cm.
-- ----------------------------------------------------------------------------
CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid,
  carrier_id uuid NOT NULL,
  service_id uuid NOT NULL,
  tracking_number varchar(120) NOT NULL,
  tracking_number_normalized varchar(120) NOT NULL,
  public_code varchar(60) NOT NULL,
  merchant_name varchar(120),
  purchase_reference varchar(120),
  status package_status NOT NULL DEFAULT 'PRE_ALERTED',
  description text,
  declared_value_minor bigint,
  declared_currency char(3),
  weight_actual numeric(12,3),
  length_value numeric(12,3),
  width_value numeric(12,3),
  height_value numeric(12,3),
  measurement_system_used measurement_system NOT NULL DEFAULT 'IMPERIAL',
  volumetric_divisor_used integer NOT NULL DEFAULT 166,
  weight_volumetric numeric(12,3),
  chargeable_weight numeric(12,3),
  origin_facility_id uuid NOT NULL,
  destination_facility_id uuid NOT NULL,
  current_facility_id uuid,
  storage_location_id uuid,
  prealerted_at timestamptz,
  received_at timestamptz,
  available_at timestamptz,
  completed_at timestamptz,
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, carrier_id, tracking_number_normalized),
  UNIQUE (organization_id, public_code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id),
  FOREIGN KEY (organization_id, carrier_id)
    REFERENCES carriers(organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services(organization_id, id),
  FOREIGN KEY (organization_id, origin_facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, destination_facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, current_facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, current_facility_id, storage_location_id)
    REFERENCES storage_locations(organization_id, facility_id, id),
  CONSTRAINT packages_tracking_not_empty_chk CHECK (
    length(tracking_number_normalized) > 0
  ),
  CONSTRAINT packages_declared_value_chk CHECK (
    declared_value_minor IS NULL OR declared_value_minor >= 0
  ),
  CONSTRAINT packages_declared_currency_chk CHECK (
    declared_currency IS NULL OR declared_currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT packages_weight_actual_chk CHECK (
    weight_actual IS NULL OR weight_actual >= 0
  ),
  CONSTRAINT packages_dimensions_complete_chk CHECK (
    num_nonnulls(length_value, width_value, height_value) = 0
    OR (
      num_nonnulls(length_value, width_value, height_value) = 3
      AND length_value > 0
      AND width_value > 0
      AND height_value > 0
    )
  ),
  CONSTRAINT packages_divisor_chk CHECK (volumetric_divisor_used > 0),
  CONSTRAINT packages_calculated_weights_chk CHECK (
    (weight_volumetric IS NULL OR weight_volumetric >= 0)
    AND (chargeable_weight IS NULL OR chargeable_weight >= 0)
  ),
  CONSTRAINT packages_location_facility_chk CHECK (
    storage_location_id IS NULL OR current_facility_id IS NOT NULL
  ),
  CONSTRAINT packages_row_version_chk CHECK (row_version > 0)
);
CREATE INDEX idx_packages_customer
  ON packages (organization_id, customer_id, created_at DESC);
CREATE INDEX idx_packages_current_facility_status
  ON packages (organization_id, current_facility_id, status, created_at DESC);
CREATE INDEX idx_packages_destination_status
  ON packages (organization_id, destination_facility_id, status, created_at DESC);
CREATE INDEX idx_packages_tracking_lookup
  ON packages (organization_id, tracking_number_normalized);

CREATE OR REPLACE FUNCTION prepare_package_values()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.tracking_number_normalized := normalize_tracking_value(NEW.tracking_number);

  IF NEW.length_value IS NOT NULL
     AND NEW.width_value IS NOT NULL
     AND NEW.height_value IS NOT NULL THEN
    NEW.weight_volumetric := round(
      (NEW.length_value * NEW.width_value * NEW.height_value)
      / NEW.volumetric_divisor_used,
      3
    );
  ELSE
    NEW.weight_volumetric := NULL;
  END IF;

  IF NEW.weight_actual IS NULL THEN
    NEW.chargeable_weight := NEW.weight_volumetric;
  ELSIF NEW.weight_volumetric IS NULL THEN
    NEW.chargeable_weight := NEW.weight_actual;
  ELSE
    NEW.chargeable_weight := greatest(NEW.weight_actual, NEW.weight_volumetric);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_packages_prepare_values
BEFORE INSERT OR UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION prepare_package_values();

CREATE TABLE package_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  package_id uuid NOT NULL,
  event_key varchar(120),
  previous_status package_status,
  status package_status NOT NULL,
  actor_id uuid REFERENCES users(id),
  facility_id uuid,
  storage_location_id uuid,
  notes text,
  is_public boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, package_id)
    REFERENCES packages(organization_id, id),
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, facility_id, storage_location_id)
    REFERENCES storage_locations(organization_id, facility_id, id),
  CONSTRAINT package_events_location_facility_chk CHECK (
    storage_location_id IS NULL OR facility_id IS NOT NULL
  )
);
CREATE UNIQUE INDEX uq_package_events_event_key
  ON package_events (organization_id, event_key)
  WHERE event_key IS NOT NULL;
CREATE INDEX idx_package_events_timeline
  ON package_events (organization_id, package_id, created_at DESC);
CREATE INDEX idx_package_events_public_tracking
  ON package_events (organization_id, package_id, created_at DESC)
  WHERE is_public = true;

-- ----------------------------------------------------------------------------
-- 10. TRANSFERS
-- ----------------------------------------------------------------------------
CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  manifest_code varchar(60) NOT NULL,
  origin_facility_id uuid NOT NULL,
  destination_facility_id uuid NOT NULL,
  status transfer_status NOT NULL DEFAULT 'PREPARING',
  transport_reference varchar(120),
  created_by uuid REFERENCES users(id),
  dispatched_at timestamptz,
  estimated_arrival_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, manifest_code),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, origin_facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, destination_facility_id)
    REFERENCES facilities(organization_id, id),
  CONSTRAINT transfers_different_facilities_chk CHECK (
    origin_facility_id <> destination_facility_id
  ),
  CONSTRAINT transfers_dates_chk CHECK (
    arrived_at IS NULL
    OR (dispatched_at IS NOT NULL AND arrived_at >= dispatched_at)
  ),
  CONSTRAINT transfers_completed_date_chk CHECK (
    completed_at IS NULL
    OR (arrived_at IS NOT NULL AND completed_at >= arrived_at)
  )
);
CREATE INDEX idx_transfers_status
  ON transfers (organization_id, status, created_at DESC);

CREATE TABLE transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  transfer_id uuid NOT NULL,
  package_id uuid NOT NULL,
  scanned_out_at timestamptz,
  scanned_in_at timestamptz,
  has_discrepancy boolean NOT NULL DEFAULT false,
  discrepancy_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, transfer_id, package_id),
  FOREIGN KEY (organization_id, transfer_id)
    REFERENCES transfers(organization_id, id),
  FOREIGN KEY (organization_id, package_id)
    REFERENCES packages(organization_id, id),
  CONSTRAINT transfer_items_dates_chk CHECK (
    scanned_in_at IS NULL
    OR (scanned_out_at IS NOT NULL AND scanned_in_at >= scanned_out_at)
  ),
  CONSTRAINT transfer_items_discrepancy_note_chk CHECK (
    has_discrepancy = false OR discrepancy_note IS NOT NULL
  )
);
CREATE INDEX idx_transfer_items_package
  ON transfer_items (organization_id, package_id);

-- ----------------------------------------------------------------------------
-- 11. RATE RULES
-- facility_id NULL = tarifa general; específica tiene prioridad.
-- Los rangos no pueden solaparse dentro del mismo alcance y vigencia.
-- ----------------------------------------------------------------------------
CREATE TABLE rate_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  facility_id uuid,
  facility_scope_key uuid GENERATED ALWAYS AS (
    coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) STORED,
  service_id uuid NOT NULL,
  name varchar(120) NOT NULL,
  currency char(3) NOT NULL,
  min_weight numeric(12,3) NOT NULL DEFAULT 0,
  max_weight numeric(12,3),
  weight_range numrange GENERATED ALWAYS AS (
    numrange(min_weight, max_weight, '[)')
  ) STORED,
  billing_increment numeric(12,3) NOT NULL DEFAULT 1,
  price_per_unit_minor bigint NOT NULL,
  minimum_charge_minor bigint NOT NULL DEFAULT 0,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  effective_range tstzrange GENERATED ALWAYS AS (
    tstzrange(effective_from, effective_to, '[)')
  ) STORED,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services(organization_id, id),
  CONSTRAINT rate_rules_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT rate_rules_weight_range_chk CHECK (
    min_weight >= 0 AND (max_weight IS NULL OR max_weight > min_weight)
  ),
  CONSTRAINT rate_rules_increment_chk CHECK (billing_increment > 0),
  CONSTRAINT rate_rules_amounts_chk CHECK (
    price_per_unit_minor >= 0 AND minimum_charge_minor >= 0
  ),
  CONSTRAINT rate_rules_dates_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  ),
  EXCLUDE USING gist (
    organization_id WITH =,
    facility_scope_key WITH =,
    service_id WITH =,
    weight_range WITH &&,
    effective_range WITH &&
  ) WHERE (is_active)
);
CREATE INDEX idx_rate_rules_lookup
  ON rate_rules (
    organization_id,
    facility_id,
    service_id,
    priority,
    effective_from,
    effective_to
  )
  WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 12. DOCUMENT SEQUENCES
-- ----------------------------------------------------------------------------
CREATE TABLE document_sequences (
  organization_id uuid NOT NULL REFERENCES organizations(id),
  document_type document_type NOT NULL,
  sequence_year integer NOT NULL,
  prefix varchar(20) NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, document_type, sequence_year),
  CONSTRAINT document_sequences_year_chk CHECK (sequence_year >= 2000),
  CONSTRAINT document_sequences_next_chk CHECK (next_value > 0)
);

CREATE OR REPLACE FUNCTION next_document_number(
  p_organization_id uuid,
  p_document_type document_type,
  p_year integer DEFAULT extract(year FROM now())::integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix varchar(20);
  v_issued_value bigint;
BEGIN
  SELECT CASE p_document_type
    WHEN 'INVOICE' THEN invoice_prefix
    WHEN 'PACKAGE' THEN package_prefix
    WHEN 'TRANSFER' THEN transfer_prefix
  END
  INTO v_prefix
  FROM organizations
  WHERE id = p_organization_id
    AND status IN ('TRIAL', 'ACTIVE');

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Enabled organization % was not found', p_organization_id;
  END IF;

  INSERT INTO document_sequences (
    organization_id,
    document_type,
    sequence_year,
    prefix,
    next_value
  )
  VALUES (p_organization_id, p_document_type, p_year, v_prefix, 2)
  ON CONFLICT (organization_id, document_type, sequence_year)
  DO UPDATE SET
    next_value = document_sequences.next_value + 1,
    prefix = excluded.prefix,
    updated_at = now()
  RETURNING next_value - 1 INTO v_issued_value;

  RETURN concat(v_prefix, '-', p_year, '-', lpad(v_issued_value::text, 6, '0'));
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. INVOICES
-- TAX y DISCOUNT se mantienen en la cabecera; no como líneas duplicadas.
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  invoice_number varchar(60),
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  currency char(3) NOT NULL,
  bill_to_name varchar(180) NOT NULL,
  bill_to_tax_id varchar(50),
  bill_to_address text,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  created_by_employee_id uuid,
  due_at timestamptz,
  issued_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id),
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, created_by_employee_id)
    REFERENCES employees(organization_id, id),
  CONSTRAINT invoices_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT invoices_totals_chk CHECK (
    subtotal_minor >= 0
    AND discount_minor >= 0
    AND tax_minor >= 0
    AND total_minor >= 0
    AND total_minor = subtotal_minor - discount_minor + tax_minor
  ),
  CONSTRAINT invoices_number_lifecycle_chk CHECK (
    (status = 'DRAFT' AND invoice_number IS NULL AND issued_at IS NULL)
    OR (status <> 'DRAFT' AND invoice_number IS NOT NULL AND issued_at IS NOT NULL)
  ),
  CONSTRAINT invoices_void_date_chk CHECK (
    status <> 'VOIDED' OR voided_at IS NOT NULL
  )
);
CREATE UNIQUE INDEX uq_invoices_number
  ON invoices (organization_id, invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE INDEX idx_invoices_customer
  ON invoices (organization_id, customer_id, created_at DESC);
CREATE INDEX idx_invoices_facility_status
  ON invoices (organization_id, facility_id, status, created_at DESC);

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  invoice_id uuid NOT NULL,
  package_id uuid,
  service_id uuid,
  rate_rule_id uuid,
  item_type invoice_item_type NOT NULL,
  description varchar(250) NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_amount_minor bigint NOT NULL,
  line_amount_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, invoice_id)
    REFERENCES invoices(organization_id, id),
  FOREIGN KEY (organization_id, package_id)
    REFERENCES packages(organization_id, id),
  FOREIGN KEY (organization_id, service_id)
    REFERENCES services(organization_id, id),
  FOREIGN KEY (organization_id, rate_rule_id)
    REFERENCES rate_rules(organization_id, id),
  CONSTRAINT invoice_items_quantity_chk CHECK (quantity > 0),
  CONSTRAINT invoice_items_amount_chk CHECK (
    unit_amount_minor >= 0
    AND line_amount_minor >= 0
    AND line_amount_minor = round(quantity * unit_amount_minor)::bigint
  )
);
CREATE INDEX idx_invoice_items_invoice
  ON invoice_items (organization_id, invoice_id);
CREATE INDEX idx_invoice_items_package
  ON invoice_items (organization_id, package_id)
  WHERE package_id IS NOT NULL;

CREATE OR REPLACE FUNCTION protect_issued_invoice_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id uuid;
  v_organization_id uuid;
  v_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);

  SELECT status
  INTO v_status
  FROM invoices
  WHERE organization_id = v_organization_id
    AND id = v_invoice_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % was not found', v_invoice_id;
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Invoice items are immutable after invoice issuance';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_items_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION protect_issued_invoice_items();

-- ----------------------------------------------------------------------------
-- 14. PAYMENTS
-- Reembolsos quedan fuera del MVP; se modelarán como movimientos separados.
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  customer_id uuid NOT NULL,
  facility_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  reference varchar(120),
  idempotency_key varchar(120),
  received_by_employee_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id)
    REFERENCES customers(organization_id, id),
  FOREIGN KEY (organization_id, facility_id)
    REFERENCES facilities(organization_id, id),
  FOREIGN KEY (organization_id, received_by_employee_id)
    REFERENCES employees(organization_id, id),
  CONSTRAINT payments_amount_chk CHECK (amount_minor > 0),
  CONSTRAINT payments_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT payments_confirmation_chk CHECK (
    status <> 'CONFIRMED' OR confirmed_at IS NOT NULL
  ),
  CONSTRAINT payments_void_chk CHECK (
    status <> 'VOIDED' OR (voided_at IS NOT NULL AND void_reason IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_payments_idempotency
  ON payments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_payments_customer
  ON payments (organization_id, customer_id, received_at DESC);

CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, payment_id, invoice_id),
  FOREIGN KEY (organization_id, payment_id)
    REFERENCES payments(organization_id, id),
  FOREIGN KEY (organization_id, invoice_id)
    REFERENCES invoices(organization_id, id),
  CONSTRAINT payment_allocations_amount_chk CHECK (amount_minor > 0)
);
CREATE INDEX idx_payment_allocations_invoice
  ON payment_allocations (organization_id, invoice_id);

CREATE VIEW invoice_balances AS
SELECT
  i.organization_id,
  i.id AS invoice_id,
  i.invoice_number,
  i.customer_id,
  i.status,
  i.currency,
  i.total_minor,
  COALESCE(
    SUM(CASE WHEN p.status = 'CONFIRMED' THEN pa.amount_minor ELSE 0 END),
    0
  ) AS amount_paid_minor,
  i.total_minor - COALESCE(
    SUM(CASE WHEN p.status = 'CONFIRMED' THEN pa.amount_minor ELSE 0 END),
    0
  ) AS amount_due_minor
FROM invoices i
LEFT JOIN payment_allocations pa
  ON pa.organization_id = i.organization_id
 AND pa.invoice_id = i.id
LEFT JOIN payments p
  ON p.organization_id = pa.organization_id
 AND p.id = pa.payment_id
GROUP BY
  i.organization_id,
  i.id,
  i.invoice_number,
  i.customer_id,
  i.status,
  i.currency,
  i.total_minor;

-- ----------------------------------------------------------------------------
-- 15. AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  actor_id uuid REFERENCES users(id),
  action audit_action NOT NULL,
  entity_type varchar(60) NOT NULL,
  entity_id uuid NOT NULL,
  request_id uuid,
  changes jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity
  ON audit_logs (organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_created
  ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_request
  ON audit_logs (request_id)
  WHERE request_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- TRIGGERS updated_at
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_facilities_updated_at
BEFORE UPDATE ON facilities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_storage_locations_updated_at
BEFORE UPDATE ON storage_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_carriers_updated_at
BEFORE UPDATE ON carriers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_packages_updated_at
BEFORE UPDATE ON packages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transfers_updated_at
BEFORE UPDATE ON transfers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rate_rules_updated_at
BEFORE UPDATE ON rate_rules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- INMUTABILIDAD
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_package_events_no_update
BEFORE UPDATE OR DELETE ON package_events
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_audit_logs_no_update
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

-- ----------------------------------------------------------------------------
-- REGLAS TRANSACCIONALES DE NESTJS/PRISMA
-- ----------------------------------------------------------------------------
-- 1. Resolver organization_id por dominio/subdominio y membresía autenticada.
-- 2. Nunca aceptar organization_id del navegador como autoridad.
-- 3. Rechazar operaciones si organization.status es SUSPENDED o CANCELLED.
-- 4. Crear carrier UNKNOWN y servicios iniciales al provisionar una organization.
-- 5. Copiar measurement_system y volumetric_divisor al recibir el paquete.
-- 6. Cambiar packages.status e insertar package_events en la misma transacción.
-- 7. Validar transiciones según estado, rol y facility actual.
-- 8. Exigir current_facility_id y storage_location_id para AVAILABLE.
-- 9. Impedir que un paquete esté en dos transfers activos simultáneamente.
-- 10. Aplicar tarifa específica de facility antes de tarifa general.
-- 11. Redondear el peso al billing_increment antes de calcular el precio.
-- 12. Emitir factura y asignar invoice_number en una sola transacción.
-- 13. Recalcular líneas y totales; TAX y DISCOUNT solo en la cabecera.
-- 14. Bloquear invoice y payment (SELECT FOR UPDATE) al asignar pagos.
-- 15. No permitir asignaciones mayores que pago confirmado o saldo de factura.
-- 16. Pago y factura deben compartir organization, customer y currency.
-- 17. Actualizar invoice_status según invoice_balances.
-- 18. Aplicar optimistic locking mediante row_version en packages.
-- 19. Generar audit_logs para operaciones sensibles y exportaciones.
-- 20. Ejecutar migraciones con prisma migrate deploy como job único.

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (FASE POSTERIOR)
-- ----------------------------------------------------------------------------
-- RLS puede habilitarse como defensa adicional cuando NestJS establezca de
-- forma segura app.current_organization_id por transacción y existan pruebas
-- automatizadas de aislamiento. Durante el MVP, el aislamiento se implementa
-- con Guards, servicios de dominio, filtros obligatorios y claves compuestas.
