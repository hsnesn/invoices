/**
 * MFA (email OTP) for manager, admin, finance, operations, viewer roles.
 * Submitter does not require MFA.
 */
export const MFA_REQUIRED_ROLES = [
  "manager",
  "admin",
  "finance",
  "operations",
  "viewer",
] as const;

export function roleRequiresMfa(role: string): boolean {
  return MFA_REQUIRED_ROLES.includes(role as (typeof MFA_REQUIRED_ROLES)[number]);
}
