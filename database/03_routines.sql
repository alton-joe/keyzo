-- =====================================================================
-- 03_routines.sql : stored function and stored procedures (transactions)
-- Executed with a DELIMITER-aware runner (Keyzo.DbTool / MySqlScript).
-- =====================================================================
USE keyzo;

DROP FUNCTION  IF EXISTS fn_invoice_balance;
DROP PROCEDURE IF EXISTS sp_generate_monthly_invoices;
DROP PROCEDURE IF EXISTS sp_record_payment;
DROP PROCEDURE IF EXISTS sp_apply_late_fees;
DROP PROCEDURE IF EXISTS sp_decide_application;
DROP PROCEDURE IF EXISTS sp_create_lease;
DROP PROCEDURE IF EXISTS sp_terminate_lease;
DROP PROCEDURE IF EXISTS sp_daily_jobs;

DELIMITER $$

-- Outstanding balance of an invoice
CREATE FUNCTION fn_invoice_balance(p_invoice_id BIGINT UNSIGNED) RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_balance DECIMAL(12,2);
  SELECT amount + late_fee - amount_paid INTO v_balance FROM rent_invoices WHERE id = p_invoice_id;
  RETURN v_balance;
END$$

-- Generate invoices for every active lease that has none for p_month (idempotent)
CREATE PROCEDURE sp_generate_monthly_invoices(IN p_month DATE, OUT p_created INT)
BEGIN
  DECLARE v_first DATE;
  SET v_first = DATE_FORMAT(p_month, '%Y-%m-01');

  INSERT INTO rent_invoices (lease_id, invoice_number, period_month, issue_date, due_date, amount)
  SELECT l.id,
         CONCAT('INV-', DATE_FORMAT(v_first, '%Y%m'), '-', LPAD(l.id, 5, '0')),
         v_first,
         v_first,
         GREATEST(DATE_ADD(v_first, INTERVAL l.rent_due_day - 1 DAY), l.start_date),
         l.monthly_rent
  FROM leases l
  WHERE l.status = 'active'
    AND l.start_date <= LAST_DAY(v_first)
    AND l.end_date   >= v_first
    AND NOT EXISTS (SELECT 1 FROM rent_invoices i WHERE i.lease_id = l.id AND i.period_month = v_first);

  SET p_created = ROW_COUNT();
END$$

-- Record a payment atomically: locks the invoice row, validates the amount, inserts the payment.
-- (trg_payments_ai then updates amount_paid/status in the same transaction.)
CREATE PROCEDURE sp_record_payment(
  IN  p_invoice_id BIGINT UNSIGNED,
  IN  p_amount     DECIMAL(12,2),
  IN  p_method     VARCHAR(20),
  IN  p_reference  VARCHAR(60),
  IN  p_note       VARCHAR(300),
  IN  p_user_id    BIGINT UNSIGNED,
  OUT p_payment_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_balance DECIMAL(12,2) DEFAULT NULL;
  DECLARE v_status  VARCHAR(20)   DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT amount + late_fee - amount_paid, status INTO v_balance, v_status
  FROM rent_invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_balance IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice not found';
  END IF;
  IF v_status = 'cancelled' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice is cancelled';
  END IF;
  IF v_balance <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invoice is already fully paid';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must be greater than zero';
  END IF;
  IF p_amount > v_balance THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds the outstanding balance';
  END IF;

  INSERT INTO payments (invoice_id, receipt_number, amount, method, reference_no, note, recorded_by)
  VALUES (p_invoice_id,
          CONCAT('RCP-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d'), '-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))),
          p_amount, p_method, p_reference, p_note, p_user_id);

  SET p_payment_id = LAST_INSERT_ID();
  COMMIT;
END$$

-- Flat late fee: mark unpaid invoices past their due date as overdue and apply the lease's flat fee once
CREATE PROCEDURE sp_apply_late_fees(IN p_date DATE, OUT p_updated INT)
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT tp.user_id, 'invoice_overdue', 'Rent overdue',
         CONCAT('Invoice ', i.invoice_number, ' was due on ', DATE_FORMAT(i.due_date, '%d %b %Y'), ' and is now overdue.'),
         '/app/invoices'
  FROM rent_invoices i
  JOIN leases l ON l.id = i.lease_id
  JOIN tenant_profiles tp ON tp.id = l.tenant_id
  WHERE i.status IN ('pending', 'partial') AND i.due_date < p_date;

  UPDATE rent_invoices i
  JOIN leases l ON l.id = i.lease_id
  SET i.late_fee = IF(i.late_fee = 0, l.late_fee, i.late_fee),
      i.status   = 'overdue'
  WHERE i.status IN ('pending', 'partial') AND i.due_date < p_date;

  SET p_updated = ROW_COUNT();
END$$

-- Approve / reject an application. Approval auto-rejects competing pending applications for the unit.
CREATE PROCEDURE sp_decide_application(
  IN p_application_id BIGINT UNSIGNED,
  IN p_approve        TINYINT(1),
  IN p_note           VARCHAR(500),
  IN p_user_id        BIGINT UNSIGNED)
BEGIN
  DECLARE v_status  VARCHAR(20) DEFAULT NULL;
  DECLARE v_unit_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_unit_status VARCHAR(20) DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status, unit_id INTO v_status, v_unit_id
  FROM rental_applications WHERE id = p_application_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found';
  END IF;
  IF v_status <> 'pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending applications can be decided';
  END IF;

  IF p_approve = 1 THEN
    SELECT status INTO v_unit_status FROM property_units WHERE id = v_unit_id FOR UPDATE;
    IF v_unit_status <> 'available' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unit is not available for rent';
    END IF;
    IF EXISTS (SELECT 1 FROM leases WHERE unit_id = v_unit_id AND status = 'active' AND end_date >= UTC_DATE()) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This unit already has an active or upcoming lease';
    END IF;
    IF EXISTS (SELECT 1 FROM rental_applications a
                WHERE a.unit_id = v_unit_id AND a.status = 'approved' AND a.id <> p_application_id
                  AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.application_id = a.id)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Another applicant is already approved for this unit';
    END IF;
    UPDATE rental_applications
       SET status = 'approved', reviewed_by = p_user_id, reviewed_at = UTC_TIMESTAMP(), review_note = p_note
     WHERE id = p_application_id;
    UPDATE rental_applications
       SET status = 'rejected', reviewed_by = p_user_id, reviewed_at = UTC_TIMESTAMP(),
           review_note = 'Another applicant was approved for this unit'
     WHERE unit_id = v_unit_id AND status = 'pending' AND id <> p_application_id;
  ELSE
    UPDATE rental_applications
       SET status = 'rejected', reviewed_by = p_user_id, reviewed_at = UTC_TIMESTAMP(), review_note = p_note
     WHERE id = p_application_id;
  END IF;

  COMMIT;
END$$

-- Create a lease from an approved application + the deposit record, atomically.
-- The overlap rule is enforced by trg_leases_bi.
CREATE PROCEDURE sp_create_lease(
  IN  p_application_id BIGINT UNSIGNED,
  IN  p_start_date     DATE,
  IN  p_end_date       DATE,
  IN  p_monthly_rent   DECIMAL(12,2),
  IN  p_deposit        DECIMAL(12,2),
  IN  p_due_day        TINYINT UNSIGNED,
  IN  p_late_fee       DECIMAL(10,2),
  IN  p_terms          TEXT,
  IN  p_user_id        BIGINT UNSIGNED,
  OUT p_lease_id       BIGINT UNSIGNED)
BEGIN
  DECLARE v_status    VARCHAR(20) DEFAULT NULL;
  DECLARE v_unit_id   BIGINT UNSIGNED;
  DECLARE v_tenant_id BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status, unit_id, tenant_id INTO v_status, v_unit_id, v_tenant_id
  FROM rental_applications WHERE id = p_application_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found';
  END IF;
  IF v_status <> 'approved' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A lease can only be created from an approved application';
  END IF;

  INSERT INTO leases (application_id, unit_id, tenant_id, start_date, end_date, monthly_rent,
                      security_deposit, rent_due_day, late_fee, terms, created_by)
  VALUES (p_application_id, v_unit_id, v_tenant_id, p_start_date, p_end_date, p_monthly_rent,
          p_deposit, p_due_day, p_late_fee, p_terms, p_user_id);

  SET p_lease_id = LAST_INSERT_ID();

  INSERT INTO deposits (lease_id, amount, received_on)
  VALUES (p_lease_id, p_deposit, UTC_DATE());

  COMMIT;
END$$

-- Terminate a lease, cancel its future unpaid invoices
CREATE PROCEDURE sp_terminate_lease(IN p_lease_id BIGINT UNSIGNED, IN p_user_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20) DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT status INTO v_status FROM leases WHERE id = p_lease_id FOR UPDATE;
  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lease not found';
  END IF;
  IF v_status = 'terminated' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lease is already terminated';
  END IF;

  UPDATE rent_invoices
     SET status = 'cancelled'
   WHERE lease_id = p_lease_id AND amount_paid = 0 AND status IN ('pending')
     AND period_month > DATE_FORMAT(UTC_DATE(), '%Y-%m-01');

  UPDATE leases SET status = 'terminated', terminated_at = UTC_TIMESTAMP() WHERE id = p_lease_id;
  COMMIT;
END$$

-- Nightly housekeeping, called by the .NET background service (and runnable by hand)
CREATE PROCEDURE sp_daily_jobs(IN p_date DATE)
BEGIN
  DECLARE v_dummy INT;

  -- 1. expire finished leases
  UPDATE leases SET status = 'expired' WHERE status = 'active' AND end_date < p_date;

  -- 2. keep unit status in sync with leases (available <-> occupied)
  UPDATE property_units u SET u.status = 'occupied'
   WHERE u.status = 'available'
     AND EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active'
                   AND l.start_date <= p_date AND l.end_date >= p_date);
  UPDATE property_units u SET u.status = 'available'
   WHERE u.status = 'occupied'
     AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active'
                       AND l.start_date <= p_date AND l.end_date >= p_date);

  -- 3. monthly invoices for the current month
  CALL sp_generate_monthly_invoices(p_date, v_dummy);

  -- 4. overdue + flat late fee
  CALL sp_apply_late_fees(p_date, v_dummy);

  -- 5. reminders: lease expiring within 30 days (once per lease)
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT tp.user_id, 'lease_expiry', 'Lease expiring soon',
         CONCAT('Your lease for unit ', u.unit_number, ' ends on ', DATE_FORMAT(l.end_date, '%d %b %Y'), '.'),
         CONCAT('/app/leases/', l.id)
  FROM leases l
  JOIN property_units u ON u.id = l.unit_id
  JOIN tenant_profiles tp ON tp.id = l.tenant_id
  WHERE l.status = 'active' AND l.end_date BETWEEN p_date AND DATE_ADD(p_date, INTERVAL 30 DAY)
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = tp.user_id AND n.type = 'lease_expiry'
                      AND n.link = CONCAT('/app/leases/', l.id));

  -- 6. reminders: rent due within 3 days (once per invoice)
  INSERT INTO notifications (user_id, type, title, message, link)
  SELECT tp.user_id, 'rent_due', 'Rent due soon',
         CONCAT('Invoice ', i.invoice_number, ' is due on ', DATE_FORMAT(i.due_date, '%d %b %Y'), '.'),
         CONCAT('/app/invoices?invoice=', i.id)
  FROM rent_invoices i
  JOIN leases l ON l.id = i.lease_id
  JOIN tenant_profiles tp ON tp.id = l.tenant_id
  WHERE i.status IN ('pending', 'partial') AND i.due_date BETWEEN p_date AND DATE_ADD(p_date, INTERVAL 3 DAY)
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = tp.user_id AND n.type = 'rent_due'
                      AND n.link = CONCAT('/app/invoices?invoice=', i.id));
END$$

DELIMITER ;
