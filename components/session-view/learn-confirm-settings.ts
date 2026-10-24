/**
 * Confirm Settings stays inert only while start is preparing the field.
 * Chapter existence does not gate Learn start.
 */
export function isIleConfirmSettingsBlocked(isPreparing: boolean): boolean {
  return isPreparing;
}

