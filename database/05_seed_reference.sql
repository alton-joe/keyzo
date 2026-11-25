-- =====================================================================
-- 05_seed_reference.sql : mandatory reference data (roles, amenities)
-- =====================================================================
USE keyzo;

INSERT INTO roles (id, name, description) VALUES
  (1, 'SuperAdmin',       'Manages the platform, users, properties and system activity'),
  (2, 'Owner',            'Registers properties, manages units and tracks income'),
  (3, 'Manager',          'Handles applications, leases, operations and maintenance coordination'),
  (4, 'Tenant',           'Applies for units, views leases and invoices, pays rent, raises maintenance requests'),
  (5, 'MaintenanceStaff', 'Receives repair assignments and updates progress');

INSERT INTO amenities (name, icon) VALUES
  ('Parking', 'car'), ('Gym', 'dumbbell'), ('Swimming Pool', 'waves'), ('24x7 Security', 'shield-check'),
  ('Power Backup', 'zap'), ('Lift', 'arrow-up-down'), ('Garden', 'trees'), ('Clubhouse', 'building-2'),
  ('CCTV', 'cctv'), ('High-speed Wi-Fi', 'wifi'), ('Play Area', 'baby'), ('Pet Friendly', 'paw-print'),
  ('Rainwater Harvesting', 'droplets'), ('Modular Kitchen', 'cooking-pot');
