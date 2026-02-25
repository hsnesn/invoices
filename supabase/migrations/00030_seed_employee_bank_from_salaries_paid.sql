-- Populate employee bank details from Salaries_Paid Excel
-- Matches by full_name and updates sort_code, bank_account_number

UPDATE employees SET bank_account_number = '52229153', sort_code = '40-14-03'
WHERE full_name = 'Barnaby Charles Edward Miller';

UPDATE employees SET bank_account_number = '63154734', sort_code = '20-95-61'
WHERE full_name = 'Bulent Vedat Balta';

UPDATE employees SET bank_account_number = '13792671', sort_code = '07-08-06'
WHERE full_name = 'Guy-Aldric Watine';

UPDATE employees SET bank_account_number = '97926167', sort_code = '60-24-23'
WHERE full_name = 'Necip Maybarskan';

UPDATE employees SET bank_account_number = '14281562', sort_code = '11-13-16'
WHERE full_name = 'Peter Edward Hasker Franks';

UPDATE employees SET bank_account_number = '87531208', sort_code = '60-07-10'
WHERE full_name = 'Paul John Mills';

UPDATE employees SET bank_account_number = '03483905', sort_code = '04-00-04'
WHERE full_name = 'Piotr Pawel Broniatowski';

UPDATE employees SET bank_account_number = '93278506', sort_code = '20-26-21'
WHERE full_name = 'Sebile Ensari';

UPDATE employees SET bank_account_number = '81357397', sort_code = '60-09-23'
WHERE full_name = 'Unal Sahin';

UPDATE employees SET bank_account_number = '01264273', sort_code = '40-08-21'
WHERE full_name = 'Simon Neale Owen Offer';
