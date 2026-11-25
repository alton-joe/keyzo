-- =====================================================================
-- Keyzo - Rental Property Management System
-- 01_schema.sql : tables, keys, constraints, indexes (MySQL 8.0, InnoDB)
-- Normalised to 3NF. All timestamps are stored in UTC.
-- =====================================================================
DROP DATABASE IF EXISTS keyzo;
CREATE DATABASE keyzo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE keyzo;

-- ---------------------------------------------------------------------
-- 1. Identity & access
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(30)  NOT NULL,
  description VARCHAR(200) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  phone         VARCHAR(20)  NULL,
  avatar_url    VARCHAR(300) NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  updated_at    DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  last_login_at DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_users_email CHECK (email LIKE '%_@_%._%')
) ENGINE=InnoDB;

-- many-to-many: a user may hold several roles
CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED  NOT NULL,
  role_id TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)    NOT NULL,
  expires_at  DATETIME    NOT NULL,
  revoked_at  DATETIME    NULL,
  created_at  DATETIME    NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_hash (token_hash),
  KEY ix_rt_user (user_id),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Properties & units
-- ---------------------------------------------------------------------
CREATE TABLE properties (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id      BIGINT UNSIGNED NOT NULL,
  manager_id    BIGINT UNSIGNED NULL,
  name          VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  property_type ENUM('apartment','house','villa','studio','hostel') NOT NULL DEFAULT 'apartment',
  address_line  VARCHAR(250) NOT NULL,
  city          VARCHAR(80)  NOT NULL,
  state         VARCHAR(80)  NOT NULL,
  postal_code   VARCHAR(12)  NOT NULL,
  country       VARCHAR(60)  NOT NULL DEFAULT 'India',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  updated_at    DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_properties_owner (owner_id),
  KEY ix_properties_manager (manager_id),
  KEY ix_properties_city (city),
  FULLTEXT KEY ft_properties_search (name, city, address_line),
  CONSTRAINT fk_properties_owner   FOREIGN KEY (owner_id)   REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_properties_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE property_units (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id    BIGINT UNSIGNED NOT NULL,
  unit_number    VARCHAR(20)   NOT NULL,
  floor_no       SMALLINT      NOT NULL DEFAULT 0,
  bedrooms       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  bathrooms      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  area_sqft      DECIMAL(8,2)  NOT NULL,
  monthly_rent   DECIMAL(12,2) NOT NULL,
  deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         ENUM('available','occupied','maintenance','inactive') NOT NULL DEFAULT 'available',
  description    VARCHAR(500) NULL,
  created_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  updated_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_unit_per_property (property_id, unit_number),
  KEY ix_units_status_rent (status, monthly_rent),
  CONSTRAINT fk_units_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT ck_units_rent  CHECK (monthly_rent > 0),
  CONSTRAINT ck_units_dep   CHECK (deposit_amount >= 0),
  CONSTRAINT ck_units_area  CHECK (area_sqft > 0)
) ENGINE=InnoDB;

CREATE TABLE property_images (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  unit_id     BIGINT UNSIGNED NULL,
  file_path   VARCHAR(300) NOT NULL,
  is_cover    TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_pi_property (property_id),
  CONSTRAINT fk_pi_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_unit     FOREIGN KEY (unit_id)     REFERENCES property_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE amenities (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  icon VARCHAR(40) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_amenities_name (name)
) ENGINE=InnoDB;

CREATE TABLE property_amenities (
  property_id BIGINT UNSIGNED   NOT NULL,
  amenity_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (property_id, amenity_id),
  CONSTRAINT fk_pa_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_amenity  FOREIGN KEY (amenity_id)  REFERENCES amenities(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Tenants & applications
-- ---------------------------------------------------------------------
-- one-to-one with users (tenant role)
CREATE TABLE tenant_profiles (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                 BIGINT UNSIGNED NOT NULL,
  date_of_birth           DATE NULL,
  occupation              VARCHAR(100) NULL,
  employer                VARCHAR(120) NULL,
  monthly_income          DECIMAL(12,2) NULL,
  emergency_contact_name  VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(20)  NULL,
  permanent_address       VARCHAR(300) NULL,
  id_proof_type           ENUM('aadhaar','passport','driving_license','voter_id','pan') NULL,
  id_proof_number         VARCHAR(40) NULL,
  created_at              DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  updated_at              DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tp_user (user_id),
  CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_tp_income CHECK (monthly_income IS NULL OR monthly_income >= 0)
) ENGINE=InnoDB;

CREATE TABLE rental_applications (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id          BIGINT UNSIGNED NOT NULL,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  desired_move_in  DATE NOT NULL,
  lease_months     TINYINT UNSIGNED NOT NULL DEFAULT 11,
  occupants        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  message          VARCHAR(1000) NULL,
  status           ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  reviewed_by      BIGINT UNSIGNED NULL,
  reviewed_at      DATETIME NULL,
  review_note      VARCHAR(500) NULL,
  created_at       DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_ra_unit_status (unit_id, status),
  KEY ix_ra_tenant (tenant_id),
  CONSTRAINT fk_ra_unit     FOREIGN KEY (unit_id)     REFERENCES property_units(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_tenant   FOREIGN KEY (tenant_id)   REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_ra_months CHECK (lease_months BETWEEN 1 AND 60)
) ENGINE=InnoDB;

CREATE TABLE tenant_documents (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NULL,
  doc_type       ENUM('id_proof','address_proof','income_proof','employment_letter','other') NOT NULL,
  file_path      VARCHAR(300) NOT NULL,
  original_name  VARCHAR(200) NOT NULL,
  is_verified    TINYINT(1) NOT NULL DEFAULT 0,
  verified_by    BIGINT UNSIGNED NULL,
  uploaded_at    DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_td_tenant (tenant_id),
  CONSTRAINT fk_td_tenant   FOREIGN KEY (tenant_id)      REFERENCES tenant_profiles(id)     ON DELETE CASCADE,
  CONSTRAINT fk_td_app      FOREIGN KEY (application_id) REFERENCES rental_applications(id) ON DELETE SET NULL,
  CONSTRAINT fk_td_verifier FOREIGN KEY (verified_by)    REFERENCES users(id)               ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Leases
-- ---------------------------------------------------------------------
CREATE TABLE leases (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NULL,
  unit_id        BIGINT UNSIGNED NOT NULL,
  tenant_id      BIGINT UNSIGNED NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  monthly_rent   DECIMAL(12,2) NOT NULL,
  security_deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  rent_due_day   TINYINT UNSIGNED NOT NULL DEFAULT 5,
  late_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,       -- flat fee charged once an invoice is overdue
  status         ENUM('active','expired','terminated') NOT NULL DEFAULT 'active',
  terms          TEXT NULL,
  terminated_at  DATETIME NULL,
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  updated_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lease_application (application_id),      -- one approved application -> at most one lease
  KEY ix_leases_unit_dates (unit_id, start_date, end_date),
  KEY ix_leases_tenant (tenant_id),
  KEY ix_leases_status_end (status, end_date),
  CONSTRAINT fk_leases_app     FOREIGN KEY (application_id) REFERENCES rental_applications(id) ON DELETE SET NULL,
  CONSTRAINT fk_leases_unit    FOREIGN KEY (unit_id)        REFERENCES property_units(id) ON DELETE RESTRICT,
  CONSTRAINT fk_leases_tenant  FOREIGN KEY (tenant_id)      REFERENCES tenant_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_leases_creator FOREIGN KEY (created_by)     REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_leases_dates CHECK (end_date > start_date),
  CONSTRAINT ck_leases_rent  CHECK (monthly_rent > 0),
  CONSTRAINT ck_leases_dep   CHECK (security_deposit >= 0),
  CONSTRAINT ck_leases_due   CHECK (rent_due_day BETWEEN 1 AND 28),
  CONSTRAINT ck_leases_fee   CHECK (late_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE lease_versions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lease_id         BIGINT UNSIGNED NOT NULL,
  version_no       INT UNSIGNED NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  monthly_rent     DECIMAL(12,2) NOT NULL,
  security_deposit DECIMAL(12,2) NOT NULL,
  change_reason    VARCHAR(200) NULL,
  created_at       DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lv (lease_id, version_no),
  CONSTRAINT fk_lv_lease FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE lease_renewals (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lease_id           BIGINT UNSIGNED NOT NULL,
  requested_by       BIGINT UNSIGNED NOT NULL,
  requested_end_date DATE NOT NULL,
  proposed_rent      DECIMAL(12,2) NULL,
  note               VARCHAR(500) NULL,
  status             ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  decided_by         BIGINT UNSIGNED NULL,
  decided_at         DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_lr_lease (lease_id, status),
  CONSTRAINT fk_lr_lease FOREIGN KEY (lease_id)     REFERENCES leases(id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_req   FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_dec   FOREIGN KEY (decided_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Rent, payments, deposits
-- ---------------------------------------------------------------------
CREATE TABLE rent_invoices (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lease_id       BIGINT UNSIGNED NOT NULL,
  invoice_number VARCHAR(30) NOT NULL,
  period_month   DATE NOT NULL,                  -- always the 1st day of the billed month
  issue_date     DATE NOT NULL,
  due_date       DATE NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  late_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         ENUM('pending','partial','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  created_at     DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_number (invoice_number),
  UNIQUE KEY uq_invoice_lease_month (lease_id, period_month),   -- no duplicate monthly invoice
  KEY ix_invoice_status_due (status, due_date),
  CONSTRAINT fk_invoice_lease FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE RESTRICT,
  CONSTRAINT ck_invoice_amount CHECK (amount > 0),
  CONSTRAINT ck_invoice_paid   CHECK (amount_paid >= 0),
  CONSTRAINT ck_invoice_fee    CHECK (late_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id     BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(30) NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  paid_at        DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  method         ENUM('cash','upi','card','bank_transfer','cheque') NOT NULL,
  reference_no   VARCHAR(60) NULL,
  note           VARCHAR(300) NULL,
  recorded_by    BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_number (receipt_number),
  KEY ix_payments_invoice (invoice_id),
  KEY ix_payments_paid_at (paid_at),
  CONSTRAINT fk_payments_invoice  FOREIGN KEY (invoice_id)  REFERENCES rent_invoices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_recorder FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE deposits (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lease_id         BIGINT UNSIGNED NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  received_on      DATE NOT NULL,
  status           ENUM('held','refunded','partially_refunded','forfeited') NOT NULL DEFAULT 'held',
  refunded_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  refunded_on      DATE NULL,
  deduction_reason VARCHAR(300) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_deposit_lease (lease_id),
  CONSTRAINT fk_deposits_lease FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE RESTRICT,
  CONSTRAINT ck_deposits_amt CHECK (amount >= 0),
  CONSTRAINT ck_deposits_ref CHECK (refunded_amount >= 0 AND refunded_amount <= amount)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Maintenance
-- ---------------------------------------------------------------------
CREATE TABLE maintenance_requests (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  unit_id     BIGINT UNSIGNED NOT NULL,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category    ENUM('plumbing','electrical','appliance','structural','pest_control','cleaning','other') NOT NULL DEFAULT 'other',
  priority    ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status      ENUM('open','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
  created_at  DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_mr_unit (unit_id),
  KEY ix_mr_tenant (tenant_id),
  KEY ix_mr_status_priority (status, priority),
  CONSTRAINT fk_mr_unit   FOREIGN KEY (unit_id)   REFERENCES property_units(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_tenant FOREIGN KEY (tenant_id) REFERENCES tenant_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE maintenance_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  file_path  VARCHAR(300) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_mi_request (request_id),
  CONSTRAINT fk_mi_request FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE maintenance_assignments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id    BIGINT UNSIGNED NOT NULL,
  staff_id      BIGINT UNSIGNED NOT NULL,
  assigned_by   BIGINT UNSIGNED NULL,
  scheduled_for DATE NULL,
  is_current    TINYINT(1) NOT NULL DEFAULT 1,
  assigned_at   DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_ma_staff (staff_id, is_current),
  KEY ix_ma_request (request_id),
  CONSTRAINT fk_ma_request FOREIGN KEY (request_id)  REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ma_staff   FOREIGN KEY (staff_id)    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ma_by      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE maintenance_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  author_id  BIGINT UNSIGNED NULL,
  status     ENUM('open','assigned','in_progress','completed','cancelled') NOT NULL,
  note       VARCHAR(1000) NULL,
  cost       DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_ml_request (request_id),
  CONSTRAINT fk_ml_request FOREIGN KEY (request_id) REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ml_author  FOREIGN KEY (author_id)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_ml_cost CHECK (cost >= 0)
) ENGINE=InnoDB;

CREATE TABLE expenses (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id  BIGINT UNSIGNED NOT NULL,
  unit_id      BIGINT UNSIGNED NULL,
  request_id   BIGINT UNSIGNED NULL,
  category     ENUM('maintenance','repairs','utilities','tax','insurance','salary','other') NOT NULL DEFAULT 'maintenance',
  description  VARCHAR(300) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  recorded_by  BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_exp_property_date (property_id, expense_date),
  CONSTRAINT fk_exp_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_unit     FOREIGN KEY (unit_id)     REFERENCES property_units(id) ON DELETE SET NULL,
  CONSTRAINT fk_exp_request  FOREIGN KEY (request_id)  REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  CONSTRAINT fk_exp_user     FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_exp_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. Notifications & audit
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  type       VARCHAR(30)  NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  link       VARCHAR(200) NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(40)  NOT NULL,
  entity      VARCHAR(40)  NOT NULL,
  entity_id   BIGINT UNSIGNED NULL,
  details     JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  PRIMARY KEY (id),
  KEY ix_audit_entity (entity, entity_id),
  KEY ix_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
