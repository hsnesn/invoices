-- Add viewer role: can see everything, create reports, but no actions. Cannot see Salaries, Setup, User Management.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';
