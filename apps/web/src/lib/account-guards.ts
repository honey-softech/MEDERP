export const LAST_SUPER_ADMIN_MESSAGE =
  "You are the only hospital admin. Close the hospital from Hospital settings or the Subscription page before leaving or deleting your account.";

/** The last active super admin of an open hospital must close it before leaving or deleting their login. */
export function lastSuperAdminBlocksSelfService(input: {
  role: string;
  hospitalIsActive: boolean;
  otherActiveSuperAdmins: number;
}) {
  return input.role === "SUPER_ADMIN" && input.hospitalIsActive && input.otherActiveSuperAdmins === 0;
}
