-- Add badge_color to employees (hex color for UI display, white text)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS badge_color text;

-- Update existing employees with full legal names and badge colors (as on payslips)
UPDATE employees SET full_name = 'Barnaby Charles Edward Miller', badge_color = '#fbb042' WHERE LOWER(email_address) = 'barney.miller@trtworld.com';
UPDATE employees SET full_name = 'Bulent Vedat Balta', badge_color = '#39b54a' WHERE LOWER(email_address) = 'vedat.balta@trtworld.com';
UPDATE employees SET full_name = 'Guy-Aldric Watine', badge_color = '#ed1c24' WHERE LOWER(email_address) = 'guy-aldric.watine@trtworld.com';
UPDATE employees SET full_name = 'Necip Maybarskan', badge_color = '#00aeef' WHERE LOWER(email_address) = 'necip.maybarskan@trtworld.com';
UPDATE employees SET full_name = 'Peter Edward Hasker Franks', badge_color = '#006838' WHERE LOWER(email_address) = 'peter.franks@trtworld.com';
UPDATE employees SET full_name = 'Paul John Mills', badge_color = '#662d91' WHERE LOWER(email_address) = 'paul.mills@trtworld.com';
UPDATE employees SET full_name = 'Sebile Ensari', badge_color = '#b9975b' WHERE LOWER(email_address) = 'sebile.ensari@trtworld.com';
UPDATE employees SET full_name = 'Unal Sahin', badge_color = '#723f8f' WHERE LOWER(email_address) = 'unal.sahin@trtworld.com';
UPDATE employees SET full_name = 'Simon Neale Owen Offer', badge_color = '#fdf200' WHERE LOWER(email_address) = 'simon.offer@trtworld.com';

-- Insert Piotr Pawel Broniatowski (new employee, sky blue)
INSERT INTO employees (full_name, email_address, badge_color, status)
SELECT 'Piotr Pawel Broniatowski', 'Piotr.Broniatowski@trtworld.com', '#50bfe6', 'active'
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE LOWER(e.email_address) = 'piotr.broniatowski@trtworld.com');

COMMENT ON COLUMN employees.badge_color IS 'Hex color for employee badge in UI (e.g. #fbb042). Text is white.';
