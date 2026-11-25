-- =====================================================================
-- 06_seed_demo.sql : demo data. Dates are relative to "today" so the demo never looks stale.
-- {{PWD}} is replaced by the DbTool with a bcrypt hash of the demo password (Keyzo@123).
-- Data flows through the real triggers/procedures, so it also exercises the business rules.
-- =====================================================================
USE keyzo;

SET @today = UTC_DATE();
SET @m0    = DATE_FORMAT(@today, '%Y-%m-01');

-- ---- users ----------------------------------------------------------
INSERT INTO users (id, email, password_hash, full_name, phone) VALUES
  (1,  'admin@keyzo.app',    '{{PWD}}', 'Keyzo Admin',    '9000000001'),
  (2,  'owner@keyzo.app',    '{{PWD}}', 'Rajesh Menon',   '9000000002'),
  (3,  'owner2@keyzo.app',   '{{PWD}}', 'Priya Nair',     '9000000003'),
  (4,  'manager@keyzo.app',  '{{PWD}}', 'Anita Thomas',   '9000000004'),
  (5,  'staff@keyzo.app',    '{{PWD}}', 'Suresh Kumar',   '9000000005'),
  (6,  'staff2@keyzo.app',   '{{PWD}}', 'Joseph Mathew',  '9000000006'),
  (7,  'tenant@keyzo.app',   '{{PWD}}', 'Arjun Varma',    '9000000007'),
  (8,  'meera@keyzo.app',    '{{PWD}}', 'Meera Iyer',     '9000000008'),
  (9,  'rohan@keyzo.app',    '{{PWD}}', 'Rohan Shah',     '9000000009'),
  (10, 'kavya@keyzo.app',    '{{PWD}}', 'Kavya Reddy',    '9000000010'),
  (11, 'dev@keyzo.app',      '{{PWD}}', 'Dev Patel',      '9000000011'),
  (12, 'neha@keyzo.app',     '{{PWD}}', 'Neha Kapoor',    '9000000012');

INSERT INTO user_roles (user_id, role_id) VALUES
  (1,1),(2,2),(3,2),(4,3),(5,5),(6,5),(7,4),(8,4),(9,4),(10,4),(11,4),(12,4);

-- ---- properties / units -------------------------------------------------
INSERT INTO properties (id, owner_id, manager_id, name, description, property_type, address_line, city, state, postal_code) VALUES
  (1, 2, 4, 'Skyline Residency',  'Modern high-rise apartments close to the IT corridor, with clubhouse and rooftop garden.', 'apartment', '12, Outer Ring Road, Marathahalli', 'Bengaluru', 'Karnataka', '560037'),
  (2, 2, 4, 'Lakeview Villas',    'Gated villa community overlooking the lake with private gardens.',                         'villa',     '7, Lake Drive, Kakkanad',            'Kochi',     'Kerala',    '682030'),
  (3, 3, NULL, 'Palm Grove Homes','Quiet low-rise residential blocks with covered parking and children''s play area.',          'apartment', '45, ECR Road, Thiruvanmiyur',        'Chennai',   'Tamil Nadu','600041'),
  (4, 3, NULL, 'Urban Nest Studios','Compact, fully furnished studios for young professionals.',                               'studio',    '88, 100 Feet Road, Indiranagar',     'Bengaluru', 'Karnataka', '560038');

INSERT INTO property_units (id, property_id, unit_number, floor_no, bedrooms, bathrooms, area_sqft, monthly_rent, deposit_amount, status, description) VALUES
  (1, 1, '101', 1, 2, 2, 1050, 28000, 56000, 'available', 'East-facing 2BHK with balcony'),
  (2, 1, '102', 1, 2, 2, 1020, 26000, 52000, 'available', '2BHK near the clubhouse'),
  (3, 1, '201', 2, 3, 3, 1450, 32000, 64000, 'available', 'Spacious 3BHK, modular kitchen'),
  (4, 1, '202', 2, 3, 2, 1400, 31000, 62000, 'available', '3BHK corner unit'),
  (5, 1, '301', 3, 2, 2, 1100, 29000, 58000, 'available', 'Top-floor 2BHK with terrace access'),
  (6, 1, '302', 3, 1, 1,  720, 19000, 38000, 'maintenance', '1BHK - under renovation'),
  (7, 2, 'V1',  0, 4, 4, 2600, 65000, 130000,'available', 'Independent 4BHK villa with garden'),
  (8, 2, 'V2',  0, 3, 3, 2100, 52000, 104000,'available', '3BHK villa, lake view'),
  (9, 2, 'V3',  0, 4, 4, 2700, 68000, 136000,'available', '4BHK villa with private pool'),
  (10,3, 'A1',  1, 2, 2,  980, 22000, 44000, 'available', 'Ground-floor 2BHK with garden access'),
  (11,3, 'A2',  1, 2, 1,  900, 20000, 40000, 'available', 'Bright 2BHK'),
  (12,3, 'B1',  2, 3, 2, 1250, 27000, 54000, 'available', '3BHK with covered parking'),
  (13,3, 'B2',  2, 1, 1,  650, 14500, 29000, 'available', 'Cosy 1BHK'),
  (14,4, 'S1',  1, 1, 1,  420, 15000, 30000, 'available', 'Furnished studio'),
  (15,4, 'S2',  1, 1, 1,  430, 15500, 31000, 'available', 'Furnished studio with workspace'),
  (16,4, 'S3',  2, 1, 1,  450, 16500, 33000, 'available', 'Furnished studio, skyline view');

INSERT INTO property_amenities (property_id, amenity_id) VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,8),(1,9),(1,10),
  (2,1),(2,4),(2,5),(2,7),(2,9),(2,12),
  (3,1),(3,4),(3,5),(3,7),(3,11),(3,13),
  (4,4),(4,5),(4,6),(4,10),(4,14);

-- ---- tenants -----------------------------------------------------------
INSERT INTO tenant_profiles (id, user_id, date_of_birth, occupation, employer, monthly_income, emergency_contact_name, emergency_contact_phone, permanent_address, id_proof_type, id_proof_number) VALUES
  (1, 7,  '1994-03-14', 'Software Engineer',  'Infosys',        120000, 'Sunil Varma',  '9811111111', 'Thrissur, Kerala',    'aadhaar',  'XXXX-XXXX-4412'),
  (2, 8,  '1992-08-21', 'Product Designer',   'Zoho',            95000, 'Lakshmi Iyer', '9822222222', 'Coimbatore',          'passport', 'M1234567'),
  (3, 9,  '1990-11-02', 'Chartered Accountant','Self-employed',  180000, 'Hetal Shah',   '9833333333', 'Ahmedabad',           'pan',      'ABCDE1234F'),
  (4, 10, '1988-05-30', 'Surgeon',            'Aster Medcity',  350000, 'Ravi Reddy',   '9844444444', 'Hyderabad',           'aadhaar',  'XXXX-XXXX-9087'),
  (5, 11, '1996-01-18', 'Data Analyst',       'TCS',             85000, 'Anil Patel',   '9855555555', 'Vadodara',            'driving_license','GJ06-2015-0045'),
  (6, 12, '1997-09-09', 'Marketing Lead',     'Swiggy',          90000, 'Rakesh Kapoor','9866666666', 'New Delhi',           'aadhaar',  'XXXX-XXXX-7731');

-- ---- applications (approved ones back the leases below) -----------------------
INSERT INTO rental_applications (id, unit_id, tenant_id, desired_move_in, lease_months, occupants, message, status, reviewed_by, reviewed_at, review_note, created_at) VALUES
  (1, 1,  1, DATE_SUB(@m0, INTERVAL 6 MONTH), 11, 2, 'Looking for a long-term home near my office.', 'approved', 4, DATE_SUB(@m0, INTERVAL 190 DAY), 'Verified documents', DATE_SUB(@m0, INTERVAL 195 DAY)),
  (2, 2,  2, DATE_SUB(@m0, INTERVAL 4 MONTH), 11, 1, 'Single occupant, non-smoker.',                  'approved', 4, DATE_SUB(@m0, INTERVAL 130 DAY), 'Approved',            DATE_SUB(@m0, INTERVAL 135 DAY)),
  (3, 3,  3, DATE_SUB(@m0, INTERVAL 9 MONTH), 11, 3, 'Family of three.',                              'approved', 4, DATE_SUB(@m0, INTERVAL 280 DAY), 'Approved',            DATE_SUB(@m0, INTERVAL 285 DAY)),
  (4, 7,  4, DATE_SUB(@m0, INTERVAL 3 MONTH), 12, 4, 'Need a villa with garden for family.',          'approved', 4, DATE_SUB(@m0, INTERVAL 100 DAY), 'Approved',            DATE_SUB(@m0, INTERVAL 105 DAY)),
  (5, 10, 5, DATE_SUB(@m0, INTERVAL 2 MONTH), 12, 2, 'Moving to Chennai for work.',                  'approved', 3, DATE_SUB(@m0, INTERVAL 70 DAY),  'Approved',            DATE_SUB(@m0, INTERVAL 75 DAY)),
  (6, 14, 6, DATE_SUB(@m0, INTERVAL 14 MONTH), 11, 1,'Studio near Indiranagar.',                     'approved', 3, DATE_SUB(@m0, INTERVAL 430 DAY), 'Approved',            DATE_SUB(@m0, INTERVAL 435 DAY)),
  (7, 4,  6, DATE_ADD(@today, INTERVAL 10 DAY), 11, 1, 'Relocating, want to move next month.',        'approved', 4, DATE_SUB(@today, INTERVAL 3 DAY), 'Approved',           DATE_SUB(@today, INTERVAL 6 DAY)),
  (8, 5,  2, DATE_ADD(@today, INTERVAL 20 DAY), 11, 1, 'Interested in the terrace unit.',             'pending',  NULL, NULL, NULL,                                       DATE_SUB(@today, INTERVAL 2 DAY)),
  (9, 5,  5, DATE_ADD(@today, INTERVAL 30 DAY), 11, 2, 'Can move in by next month.',                  'pending',  NULL, NULL, NULL,                                       DATE_SUB(@today, INTERVAL 1 DAY)),
  (10,12, 1, DATE_ADD(@today, INTERVAL 15 DAY), 11, 2, 'Prefer a parking slot.',                      'pending',  NULL, NULL, NULL,                                       DATE_SUB(@today, INTERVAL 1 DAY)),
  (11,15, 3, DATE_ADD(@today, INTERVAL 5 DAY),  6,  1, 'Short-term stay for a project.',              'rejected', 3, DATE_SUB(@today, INTERVAL 4 DAY), 'Minimum lease period is 11 months', DATE_SUB(@today, INTERVAL 8 DAY));

INSERT INTO tenant_documents (tenant_id, application_id, doc_type, file_path, original_name, is_verified, verified_by) VALUES
  (1, 1, 'id_proof',       'demo/id-proof.pdf',     'aadhaar.pdf',        1, 4),
  (1, 1, 'income_proof',   'demo/salary-slip.pdf',  'salary-slip.pdf',    1, 4),
  (2, 8, 'id_proof',       'demo/id-proof.pdf',     'passport.pdf',       0, NULL),
  (5, 9, 'employment_letter','demo/offer-letter.pdf','offer-letter.pdf',  0, NULL);

-- ---- leases (the BEFORE INSERT trigger enforces non-overlap; AFTER INSERT occupies the unit) ----
INSERT INTO leases (id, application_id, unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, rent_due_day, late_fee, status, terms, created_by) VALUES
  (1, 1, 1,  1, DATE_SUB(@m0, INTERVAL 6 MONTH),  DATE_SUB(DATE_ADD(DATE_SUB(@m0, INTERVAL 6 MONTH), INTERVAL 11 MONTH), INTERVAL 1 DAY), 28000, 56000, 5, 500,  'active', '11-month lease. Maintenance charges included. No subletting.', 4),
  (2, 2, 2,  2, DATE_SUB(@m0, INTERVAL 4 MONTH),  DATE_SUB(DATE_ADD(DATE_SUB(@m0, INTERVAL 4 MONTH), INTERVAL 11 MONTH), INTERVAL 1 DAY), 26000, 52000, 5, 500,  'active', '11-month lease. 2 months notice before vacating.', 4),
  (3, 3, 3,  3, DATE_SUB(@m0, INTERVAL 9 MONTH),  DATE_ADD(@today, INTERVAL 24 DAY), 32000, 64000, 5, 750,  'active', '11-month lease. Renewal subject to 5% rent revision.', 4),
  (4, 4, 7,  4, DATE_SUB(@m0, INTERVAL 3 MONTH),  DATE_SUB(DATE_ADD(DATE_SUB(@m0, INTERVAL 3 MONTH), INTERVAL 12 MONTH), INTERVAL 1 DAY), 65000, 130000, 1, 1000, 'active', '12-month lease. Garden upkeep by tenant.', 4),
  (5, 5, 10, 5, DATE_SUB(@m0, INTERVAL 2 MONTH),  DATE_SUB(DATE_ADD(DATE_SUB(@m0, INTERVAL 2 MONTH), INTERVAL 12 MONTH), INTERVAL 1 DAY), 22000, 44000, 5, 500,  'active', '12-month lease.', 3),
  (6, 6, 14, 6, DATE_SUB(@m0, INTERVAL 14 MONTH), DATE_SUB(@m0, INTERVAL 3 MONTH),  15000, 30000, 5, 400,  'expired', '11-month lease (completed).', 3),
  (7, 7, 4,  6, DATE_ADD(@today, INTERVAL 10 DAY), DATE_ADD(@today, INTERVAL 340 DAY), 31000, 62000, 5, 500, 'active', '11-month lease starting soon.', 4);

INSERT INTO deposits (lease_id, amount, received_on, status, refunded_amount, refunded_on, deduction_reason) VALUES
  (1, 56000,  DATE_SUB(@m0, INTERVAL 6 MONTH), 'held', 0, NULL, NULL),
  (2, 52000,  DATE_SUB(@m0, INTERVAL 4 MONTH), 'held', 0, NULL, NULL),
  (3, 64000,  DATE_SUB(@m0, INTERVAL 9 MONTH), 'held', 0, NULL, NULL),
  (4, 130000, DATE_SUB(@m0, INTERVAL 3 MONTH), 'held', 0, NULL, NULL),
  (5, 44000,  DATE_SUB(@m0, INTERVAL 2 MONTH), 'held', 0, NULL, NULL),
  (6, 30000,  DATE_SUB(@m0, INTERVAL 14 MONTH),'partially_refunded', 27500, DATE_SUB(@m0, INTERVAL 3 MONTH), 'Deduction for repainting'),
  (7, 62000,  @today, 'held', 0, NULL, NULL);

-- a renewal request on the lease that expires soon
INSERT INTO lease_renewals (lease_id, requested_by, requested_end_date, proposed_rent, note)
VALUES (3, 9, DATE_ADD(@today, INTERVAL 389 DAY), 33600, 'Happy to renew for another 11 months with the 5% revision.');

-- ---- invoices for the last 6 months through the real procedure ------------------
SET @n = 0;
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 6 MONTH), @n);
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 5 MONTH), @n);
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 4 MONTH), @n);
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 3 MONTH), @n);
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 2 MONTH), @n);
CALL sp_generate_monthly_invoices(DATE_SUB(@m0, INTERVAL 1 MONTH), @n);
CALL sp_generate_monthly_invoices(@m0, @n);

-- payments: a trigger updates the invoice, which the INSERT..SELECT may not read -> stage in a temp table
DROP TEMPORARY TABLE IF EXISTS tmp_pay;
CREATE TEMPORARY TABLE tmp_pay AS
SELECT i.id AS invoice_id, i.amount, i.due_date, i.lease_id, i.period_month
  FROM rent_invoices i
 WHERE i.period_month < @m0
   AND NOT (i.period_month = DATE_SUB(@m0, INTERVAL 1 MONTH) AND i.lease_id IN (2, 3, 5))   -- leave these unpaid / partial
UNION ALL
SELECT i.id, i.amount, i.due_date, i.lease_id, i.period_month
  FROM rent_invoices i
 WHERE i.period_month = @m0 AND i.lease_id IN (1, 4);

INSERT INTO payments (invoice_id, receipt_number, amount, paid_at, method, reference_no, recorded_by)
SELECT t.invoice_id,
       CONCAT('RCP-', DATE_FORMAT(t.due_date, '%Y%m%d'), '-', LPAD(t.invoice_id, 6, '0')),
       t.amount,
       TIMESTAMP(DATE_SUB(t.due_date, INTERVAL (t.invoice_id % 3) DAY), '10:30:00'),
       ELT(1 + (t.invoice_id % 4), 'upi', 'bank_transfer', 'card', 'cash'),
       CONCAT('TXN', LPAD(t.invoice_id * 7919 % 1000000, 6, '0')),
       IF(t.lease_id IN (5, 6), 3, 4)
  FROM tmp_pay t;
DROP TEMPORARY TABLE tmp_pay;

-- one partial payment (lease 3, last month)
SELECT id, due_date INTO @part_inv, @part_due FROM rent_invoices WHERE lease_id = 3 AND period_month = DATE_SUB(@m0, INTERVAL 1 MONTH);
INSERT INTO payments (invoice_id, receipt_number, amount, paid_at, method, reference_no, recorded_by)
VALUES (@part_inv, CONCAT('RCP-PART-', LPAD(@part_inv, 6, '0')), 15000, TIMESTAMP(DATE_ADD(@part_due, INTERVAL 2 DAY), '11:15:00'), 'upi', 'TXN-PARTIAL-1', 4);

-- overdue marking + flat late fee, via the real procedure
CALL sp_apply_late_fees(@today, @n);

-- ---- maintenance --------------------------------------------------------------
INSERT INTO maintenance_requests (id, unit_id, tenant_id, title, description, category, priority, created_at) VALUES
  (1, 1,  1, 'Kitchen tap leaking',            'The kitchen sink tap has been dripping for two days and is getting worse.', 'plumbing',   'medium', DATE_SUB(@today, INTERVAL 20 DAY)),
  (2, 2,  2, 'Bedroom AC not cooling',          'The split AC in the master bedroom blows warm air.',                          'appliance',  'high',   DATE_SUB(@today, INTERVAL 9 DAY)),
  (3, 3,  3, 'Power socket sparking',           'The socket near the study table sparks when plugging in a charger.',         'electrical', 'urgent', DATE_SUB(@today, INTERVAL 4 DAY)),
  (4, 7,  4, 'Garden drainage blocked',         'Water collects in the front garden after rain.',                              'plumbing',   'low',    DATE_SUB(@today, INTERVAL 2 DAY)),
  (5, 10, 5, 'Cockroach infestation',           'Cockroaches in the kitchen cabinets.',                                       'pest_control','medium',DATE_SUB(@today, INTERVAL 15 DAY)),
  (6, 1,  1, 'Bathroom door lock broken',       'Lock in the common bathroom door no longer latches.',                        'structural', 'low',    DATE_SUB(@today, INTERVAL 40 DAY));

-- initial 'open' log (written by the app in production)
DROP TEMPORARY TABLE IF EXISTS tmp_open_logs;
CREATE TEMPORARY TABLE tmp_open_logs AS
SELECT r.id AS request_id, tp.user_id, r.created_at
  FROM maintenance_requests r JOIN tenant_profiles tp ON tp.id = r.tenant_id;
INSERT INTO maintenance_logs (request_id, author_id, status, note, created_at)
SELECT request_id, user_id, 'open', 'Request submitted', created_at FROM tmp_open_logs;
DROP TEMPORARY TABLE tmp_open_logs;

INSERT INTO maintenance_assignments (request_id, staff_id, assigned_by, scheduled_for, is_current, assigned_at) VALUES
  (1, 5, 4, DATE_SUB(@today, INTERVAL 18 DAY), 1, DATE_SUB(@today, INTERVAL 19 DAY)),
  (2, 5, 4, DATE_ADD(@today, INTERVAL 1 DAY),  1, DATE_SUB(@today, INTERVAL 7 DAY)),
  (3, 6, 4, @today,                            1, DATE_SUB(@today, INTERVAL 3 DAY)),
  (5, 6, 3, DATE_SUB(@today, INTERVAL 12 DAY), 1, DATE_SUB(@today, INTERVAL 14 DAY)),
  (6, 5, 4, DATE_SUB(@today, INTERVAL 35 DAY), 1, DATE_SUB(@today, INTERVAL 38 DAY));

INSERT INTO maintenance_logs (request_id, author_id, status, note, cost, created_at) VALUES
  (1, 4, 'assigned',    'Assigned to Suresh',                              0,    DATE_SUB(@today, INTERVAL 19 DAY)),
  (1, 5, 'in_progress', 'Inspected - washer needs replacement',            0,    DATE_SUB(@today, INTERVAL 18 DAY)),
  (1, 5, 'completed',   'Replaced tap cartridge and washer',               850,  DATE_SUB(@today, INTERVAL 18 DAY)),
  (2, 4, 'assigned',    'Assigned to Suresh',                              0,    DATE_SUB(@today, INTERVAL 7 DAY)),
  (2, 5, 'in_progress', 'Gas refill required; technician booked',          0,    DATE_SUB(@today, INTERVAL 5 DAY)),
  (3, 4, 'assigned',    'Urgent - assigned to Joseph',                     0,    DATE_SUB(@today, INTERVAL 3 DAY)),
  (3, 6, 'in_progress', 'Power isolated; replacing socket and wiring',     0,    DATE_SUB(@today, INTERVAL 2 DAY)),
  (5, 3, 'assigned',    'Pest control scheduled',                          0,    DATE_SUB(@today, INTERVAL 14 DAY)),
  (5, 6, 'completed',   'Gel treatment and sealing completed',             1800, DATE_SUB(@today, INTERVAL 12 DAY)),
  (6, 4, 'assigned',    'Assigned to Suresh',                              0,    DATE_SUB(@today, INTERVAL 38 DAY)),
  (6, 5, 'completed',   'Replaced the lock set',                           650,  DATE_SUB(@today, INTERVAL 35 DAY));

-- other property expenses (for the finance reports)
INSERT INTO expenses (property_id, category, description, amount, expense_date, recorded_by) VALUES
  (1, 'tax',       'Property tax - half yearly',          42000, DATE_SUB(@today, INTERVAL 70 DAY), 2),
  (1, 'utilities', 'Common area electricity',              9800, DATE_SUB(@today, INTERVAL 30 DAY), 4),
  (1, 'insurance', 'Building insurance premium',          18500, DATE_SUB(@today, INTERVAL 100 DAY), 2),
  (2, 'utilities', 'Garden water & community upkeep',      6400, DATE_SUB(@today, INTERVAL 25 DAY), 4),
  (3, 'tax',       'Property tax - half yearly',          28000, DATE_SUB(@today, INTERVAL 60 DAY), 3),
  (4, 'salary',    'Caretaker salary',                    12000, DATE_SUB(@today, INTERVAL 10 DAY), 3);

-- ---- tidy up trigger noise, then add a few curated, recent notifications ------------
DELETE FROM notifications;
INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at) VALUES
  (7,  'invoice_created',  'New rent invoice',     'Your invoice for this month has been generated.',                      '/app/invoices', 0, NOW()),
  (7,  'maintenance_update','Maintenance update',  '"Kitchen tap leaking" is now completed.',                              '/app/maintenance/1', 1, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (8,  'invoice_overdue',  'Rent overdue',         'Your invoice for last month is overdue.',                              '/app/invoices', 0, NOW()),
  (4,  'application_new',  'New rental application','Meera Iyer applied for unit 301 at Skyline Residency.',               '/app/applications', 0, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (4,  'maintenance_new',  'Urgent maintenance',   'Power socket sparking (urgent) - unit 201, Skyline Residency.',        '/app/maintenance/3', 0, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (2,  'lease_expiry',     'Lease expiring soon',  'Unit 201 (Skyline Residency) lease ends in 24 days; a renewal was requested.', '/app/leases/3', 0, NOW()),
  (5,  'maintenance_assigned','New job assigned',  'You were assigned: Bedroom AC not cooling',                            '/app/maintenance/2', 0, DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (6,  'maintenance_assigned','New job assigned',  'You were assigned: Power socket sparking',                             '/app/maintenance/3', 0, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (1,  'system',           'Welcome to Keyzo',     'The demo database has been seeded with sample data.',                  NULL, 0, NOW());
