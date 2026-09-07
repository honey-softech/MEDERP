/** Always scope hospital records by the signed-in hospital, never by a client-supplied id. */
export function hospitalScope(hospitalId: string) {
  return { hospitalId };
}

export function belongsToHospital(
  resource: { hospitalId: string } | null | undefined,
  actorHospitalId: string,
) {
  return Boolean(resource && resource.hospitalId === actorHospitalId);
}
