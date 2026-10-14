/** A mobile or email can be used again when it is not tied to an open hospital. */
export function mobileCanBeRecreated(input: {
  isActive: boolean;
  hospitalId: string | null;
  hospitalIsActive: boolean | null;
}) {
  const onOpenHospital = Boolean(input.hospitalId) && input.hospitalIsActive === true;
  if (onOpenHospital && input.isActive) return false;
  if (onOpenHospital && !input.isActive) return false;
  return true;
}
