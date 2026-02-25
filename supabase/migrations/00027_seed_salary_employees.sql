-- Seed employees with full legal names (as on payslips) and email addresses
-- Names include middle names where applicable

INSERT INTO employees (full_name, email_address, badge_color, status)
SELECT v.full_name, v.email_address, v.badge_color, v.status
FROM (VALUES
  ('Barnaby Charles Edward Miller', 'Barney.MILLER@trtworld.com', '#fbb042', 'active'),
  ('Bulent Vedat Balta', 'Vedat.BALTA@trtworld.com', '#39b54a', 'active'),
  ('Guy-Aldric Watine', 'Guy-Aldric.WATINE@trtworld.com', '#ed1c24', 'active'),
  ('Necip Maybarskan', 'Necip.MAYBARSKAN@trtworld.com', '#00aeef', 'active'),
  ('Paul John Mills', 'Paul.MILLS@trtworld.com', '#662d91', 'active'),
  ('Peter Edward Hasker Franks', 'Peter.FRANKS@trtworld.com', '#006838', 'active'),
  ('Simon Neale Owen Offer', 'Simon.OFFER@trtworld.com', '#fdf200', 'active'),
  ('Sebile Ensari', 'Sebile.ENSARI@trtworld.com', '#b9975b', 'active'),
  ('Unal Sahin', 'Unal.Sahin@trtworld.com', '#723f8f', 'active'),
  ('Piotr Pawel Broniatowski', 'Piotr.Broniatowski@trtworld.com', '#50bfe6', 'active')
) AS v(full_name, email_address, badge_color, status)
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE LOWER(e.email_address) = LOWER(v.email_address));
