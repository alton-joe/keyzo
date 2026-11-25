-- =====================================================================
-- 02_views.sql : reporting views (read-only abstractions over the schema)
-- =====================================================================
USE keyzo;

-- Occupancy per property
CREATE OR REPLACE VIEW v_property_occupancy AS
SELECT p.id                                         AS property_id,
       p.name                                       AS property_name,
       p.owner_id,
       p.manager_id,
       COUNT(u.id)                                  AS total_units,
       COALESCE(SUM(u.status = 'occupied'), 0)      AS occupied_units,
       COALESCE(SUM(u.status = 'available'), 0)     AS available_units,
       ROUND(100 * COALESCE(SUM(u.status = 'occupied'), 0) / NULLIF(COUNT(u.id), 0), 1) AS occupancy_pct
FROM properties p
LEFT JOIN property_units u ON u.property_id = p.id AND u.status <> 'inactive'
WHERE p.is_active = 1
GROUP BY p.id, p.name, p.owner_id, p.manager_id;

-- Lease with effective (date-aware) status: upcoming / active / expired / terminated
CREATE OR REPLACE VIEW v_lease_effective_status AS
SELECT l.id AS lease_id, l.unit_id, l.tenant_id, l.start_date, l.end_date, l.monthly_rent,
       CASE
         WHEN l.status = 'terminated'      THEN 'terminated'
         WHEN UTC_DATE() < l.start_date    THEN 'upcoming'
         WHEN UTC_DATE() > l.end_date      THEN 'expired'
         ELSE 'active'
       END AS effective_status,
       DATEDIFF(l.end_date, UTC_DATE()) AS days_to_expiry
FROM leases l;

-- Billing by month and property: billed vs collected vs outstanding
CREATE OR REPLACE VIEW v_monthly_billing AS
SELECT p.id AS property_id, p.owner_id, p.manager_id, i.period_month,
       COUNT(i.id)                                   AS invoices,
       SUM(i.amount + i.late_fee)                    AS billed,
       SUM(i.amount_paid)                            AS collected,
       SUM(i.amount + i.late_fee - i.amount_paid)    AS outstanding
FROM rent_invoices i
JOIN leases l          ON l.id = i.lease_id
JOIN property_units u  ON u.id = l.unit_id
JOIN properties p      ON p.id = u.property_id
WHERE i.status <> 'cancelled'
GROUP BY p.id, p.owner_id, p.manager_id, i.period_month;

-- Invoices that are past due and not fully paid
CREATE OR REPLACE VIEW v_overdue_invoices AS
SELECT i.id AS invoice_id, i.invoice_number, i.lease_id, i.due_date,
       i.amount + i.late_fee - i.amount_paid AS balance,
       DATEDIFF(UTC_DATE(), i.due_date)      AS days_overdue,
       u.id AS unit_id, u.unit_number, p.id AS property_id, p.name AS property_name,
       p.owner_id, p.manager_id, t.id AS tenant_id, us.full_name AS tenant_name
FROM rent_invoices i
JOIN leases l            ON l.id = i.lease_id
JOIN property_units u    ON u.id = l.unit_id
JOIN properties p        ON p.id = u.property_id
JOIN tenant_profiles t   ON t.id = l.tenant_id
JOIN users us            ON us.id = t.user_id
WHERE i.status IN ('pending','partial','overdue')
  AND i.due_date < UTC_DATE()
  AND i.amount + i.late_fee > i.amount_paid;

-- Maintenance spend per property and month
CREATE OR REPLACE VIEW v_maintenance_expenses AS
SELECT e.property_id, p.owner_id, p.manager_id,
       DATE_FORMAT(e.expense_date, '%Y-%m-01') AS month_start,
       e.category, SUM(e.amount) AS total
FROM expenses e
JOIN properties p ON p.id = e.property_id
GROUP BY e.property_id, p.owner_id, p.manager_id, DATE_FORMAT(e.expense_date, '%Y-%m-01'), e.category;

-- Tenant ledger: billed, paid and outstanding per tenant
CREATE OR REPLACE VIEW v_tenant_ledger AS
SELECT t.id AS tenant_id, u.full_name AS tenant_name, u.email,
       COUNT(i.id)                                AS invoices,
       COALESCE(SUM(i.amount + i.late_fee), 0)    AS billed,
       COALESCE(SUM(i.amount_paid), 0)            AS paid,
       COALESCE(SUM(i.amount + i.late_fee - i.amount_paid), 0) AS outstanding
FROM tenant_profiles t
JOIN users u ON u.id = t.user_id
LEFT JOIN leases l ON l.tenant_id = t.id
LEFT JOIN rent_invoices i ON i.lease_id = l.id AND i.status <> 'cancelled'
GROUP BY t.id, u.full_name, u.email;
