-- Seed default employee (placeholder for salary payment confirmation emails)
INSERT INTO employees (full_name, ni_number, bank_account_number, sort_code, email_address, status)
SELECT 'Placeholder Employee', NULL, NULL, NULL, 'hasanesen@gmail.com', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email_address = 'hasanesen@gmail.com');
