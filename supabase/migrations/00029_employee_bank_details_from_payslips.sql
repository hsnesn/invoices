-- Update employees with bank details from payslip data (Salaries_Paid Excel)
-- Run after salaries have been imported; updates employees where we have bank info

UPDATE employees SET bank_account_number = '52229153', sort_code = '40-14-03'
WHERE full_name = 'Barnaby Charles Edward Miller' AND (bank_account_number IS NULL OR bank_account_number = '');

UPDATE employees SET bank_account_number = '63154734', sort_code = '20-95-61'
WHERE full_name = 'Bulent Vedat Balta' AND (bank_account_number IS NULL OR bank_account_number = '');
