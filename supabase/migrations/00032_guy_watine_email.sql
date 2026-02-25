-- Update Guy Watine's email to Guy.WATINE@trtworld.com (guy-aldric.watine@trtworld.com no longer used)
UPDATE employees
SET email_address = 'Guy.WATINE@trtworld.com'
WHERE full_name ILIKE '%Guy%Aldric%Watine%'
   OR full_name ILIKE '%Guy Watine%'
   OR LOWER(email_address) = 'guy-aldric.watine@trtworld.com';
