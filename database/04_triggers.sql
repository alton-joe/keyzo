-- =====================================================================
-- 04_triggers.sql : integrity rules, versioning, auditing, notifications
-- =====================================================================
USE keyzo;

DROP TRIGGER IF EXISTS trg_leases_bi;
DROP TRIGGER IF EXISTS trg_leases_bu;
DROP TRIGGER IF EXISTS trg_leases_ai;
DROP TRIGGER IF EXISTS trg_leases_au;
DROP TRIGGER IF EXISTS trg_payments_ai;
DROP TRIGGER IF EXISTS trg_invoices_ai;
DROP TRIGGER IF EXISTS trg_applications_ai;
DROP TRIGGER IF EXISTS trg_applications_au;
DROP TRIGGER IF EXISTS trg_maint_requests_ai;
DROP TRIGGER IF EXISTS trg_maint_requests_bu;
DROP TRIGGER IF EXISTS trg_maint_requests_au;
DROP TRIGGER IF EXISTS trg_maint_assign_ai;
DROP TRIGGER IF EXISTS trg_maint_logs_ai;

DELIMITER $$

-- ---- Leases: prevent overlapping ACTIVE leases on the same unit -------------
CREATE TRIGGER trg_leases_bi BEFORE INSERT ON leases FOR EACH ROW
BEGIN
  IF NEW.status = 'active' AND EXISTS (
       SELECT 1 FROM leases l
        WHERE l.unit_id = NEW.unit_id AND l.status = 'active'
          AND NEW.start_date <= l.end_date AND NEW.end_date >= l.start_date) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The unit already has an active lease overlapping these dates';
  END IF;
END$$

CREATE TRIGGER trg_leases_bu BEFORE UPDATE ON leases FOR EACH ROW
BEGIN
  IF NEW.status = 'active' AND EXISTS (
       SELECT 1 FROM leases l
        WHERE l.unit_id = NEW.unit_id AND l.status = 'active' AND l.id <> NEW.id
          AND NEW.start_date <= l.end_date AND NEW.end_date >= l.start_date) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The unit already has an active lease overlapping these dates';
  END IF;
  SET NEW.updated_at = UTC_TIMESTAMP();
END$$

-- ---- Leases: version 1, occupy unit, audit, notify tenant -------------------
CREATE TRIGGER trg_leases_ai AFTER INSERT ON leases FOR EACH ROW
BEGIN
  DECLARE v_user BIGINT UNSIGNED;

  INSERT INTO lease_versions (lease_id, version_no, start_date, end_date, monthly_rent, security_deposit, change_reason)
  VALUES (NEW.id, 1, NEW.start_date, NEW.end_date, NEW.monthly_rent, NEW.security_deposit, 'Initial agreement');

  IF NEW.status = 'active' AND NEW.start_date <= UTC_DATE() AND NEW.end_date >= UTC_DATE() THEN
    UPDATE property_units SET status = 'occupied' WHERE id = NEW.unit_id AND status = 'available';
  END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (NEW.created_by, 'create', 'lease', NEW.id,
          JSON_OBJECT('unit_id', NEW.unit_id, 'tenant_id', NEW.tenant_id, 'rent', NEW.monthly_rent));

  SELECT user_id INTO v_user FROM tenant_profiles WHERE id = NEW.tenant_id;
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (v_user, 'lease_created', 'Your lease is ready',
          CONCAT('A lease starting ', DATE_FORMAT(NEW.start_date, '%d %b %Y'), ' has been created for you.'),
          CONCAT('/app/leases/', NEW.id));
END$$

-- ---- Leases: new version when terms change; free unit when lease ends -------
CREATE TRIGGER trg_leases_au AFTER UPDATE ON leases FOR EACH ROW
BEGIN
  IF NOT (OLD.start_date <=> NEW.start_date AND OLD.end_date <=> NEW.end_date
          AND OLD.monthly_rent <=> NEW.monthly_rent AND OLD.security_deposit <=> NEW.security_deposit) THEN
    INSERT INTO lease_versions (lease_id, version_no, start_date, end_date, monthly_rent, security_deposit, change_reason)
    SELECT NEW.id, COALESCE(MAX(version_no), 0) + 1, NEW.start_date, NEW.end_date,
           NEW.monthly_rent, NEW.security_deposit, 'Terms updated'
      FROM lease_versions WHERE lease_id = NEW.id;
  END IF;

  IF OLD.status = 'active' AND NEW.status IN ('terminated', 'expired') THEN
    UPDATE property_units u SET u.status = 'available'
     WHERE u.id = NEW.unit_id AND u.status = 'occupied'
       AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = NEW.unit_id AND l.status = 'active'
                         AND l.id <> NEW.id AND l.start_date <= UTC_DATE() AND l.end_date >= UTC_DATE());
  END IF;

  IF OLD.status <> NEW.status OR NOT (OLD.monthly_rent <=> NEW.monthly_rent) THEN
    INSERT INTO audit_logs (action, entity, entity_id, details)
    VALUES ('update', 'lease', NEW.id,
            JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status,
                        'old_rent', OLD.monthly_rent, 'new_rent', NEW.monthly_rent));
  END IF;
END$$

-- ---- Invoices: notify tenant of new invoice ---------------------------------
CREATE TRIGGER trg_invoices_ai AFTER INSERT ON rent_invoices FOR EACH ROW
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT tp.user_id, 'invoice_created', 'New rent invoice',
         CONCAT('Invoice ', NEW.invoice_number, ' for ', DATE_FORMAT(NEW.period_month, '%b %Y'),
                ' is due on ', DATE_FORMAT(NEW.due_date, '%d %b %Y'), '.'),
         CONCAT('/app/invoices?invoice=', NEW.id)
    FROM leases l JOIN tenant_profiles tp ON tp.id = l.tenant_id
   WHERE l.id = NEW.lease_id;
END$$

-- ---- Payments: roll the payment into the invoice, audit, notify -------------
-- NOTE: MySQL evaluates single-table UPDATE assignments left-to-right, so in the CASE
--       `amount_paid` already holds the NEW total.
CREATE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW
BEGIN
  UPDATE rent_invoices
     SET amount_paid = amount_paid + NEW.amount,
         status = CASE
                    WHEN amount_paid >= amount + late_fee THEN 'paid'
                    WHEN status = 'overdue'               THEN 'overdue'   -- (status still holds the OLD value here)
                    ELSE 'partial'
                  END
   WHERE id = NEW.invoice_id;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
  VALUES (NEW.recorded_by, 'create', 'payment', NEW.id,
          JSON_OBJECT('invoice_id', NEW.invoice_id, 'amount', NEW.amount, 'method', NEW.method));

  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT tp.user_id, 'payment_received', 'Payment received',
         CONCAT('Receipt ', NEW.receipt_number, ' for ', FORMAT(NEW.amount, 2), ' has been recorded.'),
         CONCAT('/app/invoices?invoice=', NEW.invoice_id)
    FROM rent_invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN tenant_profiles tp ON tp.id = l.tenant_id
   WHERE i.id = NEW.invoice_id;
END$$

-- ---- Rental applications: notify staff on submit, tenant on decision --------
CREATE TRIGGER trg_applications_ai AFTER INSERT ON rental_applications FOR EACH ROW
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT p.owner_id, 'application_new', 'New rental application',
         CONCAT('A new application was submitted for unit ', u.unit_number, ' at ', p.name, '.'), '/app/applications'
    FROM property_units u JOIN properties p ON p.id = u.property_id WHERE u.id = NEW.unit_id
  UNION
  SELECT p.manager_id, 'application_new', 'New rental application',
         CONCAT('A new application was submitted for unit ', u.unit_number, ' at ', p.name, '.'), '/app/applications'
    FROM property_units u JOIN properties p ON p.id = u.property_id
   WHERE u.id = NEW.unit_id AND p.manager_id IS NOT NULL;
END$$

CREATE TRIGGER trg_applications_au AFTER UPDATE ON rental_applications FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT tp.user_id, CONCAT('application_', NEW.status),
           CONCAT('Application ', NEW.status),
           CONCAT('Your application for unit ', u.unit_number, ' was ', NEW.status, '.'),
           '/app/applications'
      FROM tenant_profiles tp, property_units u
     WHERE tp.id = NEW.tenant_id AND u.id = NEW.unit_id;

    INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
    VALUES (NEW.reviewed_by, NEW.status, 'rental_application', NEW.id, JSON_OBJECT('unit_id', NEW.unit_id));
  END IF;
END$$

-- ---- Maintenance ------------------------------------------------------------
CREATE TRIGGER trg_maint_requests_ai AFTER INSERT ON maintenance_requests FOR EACH ROW
BEGIN
  -- (the initial 'open' log row is written by the application: a trigger on this table
  --  may not touch maintenance_requests again, see trg_maint_logs_ai)
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT p.owner_id, 'maintenance_new', 'New maintenance request',
         CONCAT(NEW.title, ' (', NEW.priority, ') - unit ', u.unit_number, ', ', p.name), CONCAT('/app/maintenance/', NEW.id)
    FROM property_units u JOIN properties p ON p.id = u.property_id WHERE u.id = NEW.unit_id
  UNION
  SELECT p.manager_id, 'maintenance_new', 'New maintenance request',
         CONCAT(NEW.title, ' (', NEW.priority, ') - unit ', u.unit_number, ', ', p.name), CONCAT('/app/maintenance/', NEW.id)
    FROM property_units u JOIN properties p ON p.id = u.property_id
   WHERE u.id = NEW.unit_id AND p.manager_id IS NOT NULL;
END$$

CREATE TRIGGER trg_maint_requests_bu BEFORE UPDATE ON maintenance_requests FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    SET NEW.completed_at = UTC_TIMESTAMP();
  END IF;
END$$

CREATE TRIGGER trg_maint_requests_au AFTER UPDATE ON maintenance_requests FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    SELECT tp.user_id, 'maintenance_update', 'Maintenance update',
           CONCAT('"', NEW.title, '" is now ', REPLACE(NEW.status, '_', ' '), '.'), CONCAT('/app/maintenance/', NEW.id)
      FROM tenant_profiles tp WHERE tp.id = NEW.tenant_id;
  END IF;
END$$

CREATE TRIGGER trg_maint_assign_ai AFTER INSERT ON maintenance_assignments FOR EACH ROW
BEGIN
  -- (the application clears is_current on earlier assignments before inserting a new one:
  --  a trigger cannot update the table that fired it)
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT NEW.staff_id, 'maintenance_assigned', 'New job assigned',
         CONCAT('You were assigned: ', r.title), CONCAT('/app/maintenance/', r.id)
    FROM maintenance_requests r WHERE r.id = NEW.request_id;
END$$

-- A log entry drives the request status and (when it carries a cost) creates the expense row
CREATE TRIGGER trg_maint_logs_ai AFTER INSERT ON maintenance_logs FOR EACH ROW
BEGIN
  UPDATE maintenance_requests SET status = NEW.status WHERE id = NEW.request_id AND status <> NEW.status;

  IF NEW.cost > 0 THEN
    INSERT INTO expenses (property_id, unit_id, request_id, category, description, amount, expense_date, recorded_by)
    SELECT u.property_id, r.unit_id, r.id, 'maintenance',
           CONCAT('Maintenance: ', r.title), NEW.cost, UTC_DATE(), NEW.author_id
      FROM maintenance_requests r JOIN property_units u ON u.id = r.unit_id
     WHERE r.id = NEW.request_id;
  END IF;
END$$

DELIMITER ;
