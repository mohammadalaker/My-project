/** Barcodes that should display group/logo as "KMG" only (no DB change) */
export const BARCODES_DISPLAY_AS_KMG = ['7290020124852', '7290020124869', '7290020124876'];

/**
 * Returns the display group name for UI (logo + label).
 * For the three KMG barcodes returns "KMG", otherwise returns the given group.
 */
export function getDisplayGroupForBarcode(barcode, group) {
  const code = barcode != null ? String(barcode).trim() : '';
  if (BARCODES_DISPLAY_AS_KMG.includes(code)) return 'KMG';
  return group ?? '';
}
