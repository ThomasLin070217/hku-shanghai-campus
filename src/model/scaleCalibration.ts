/** Amap native satellite ruler, 2026-11-14. Practical uncertainty, not a survey.
 * See references/scale-calibration/REPORT.md and measurements.json.
 * North pair measured directly; shared tower column alignment is inferred.
 * Do not use this horizontal check to validate height or underground levels. */
export const SCALE_CALIBRATION = {
 id: 'amap-2026-11-14',
 appliesTo: 'default layout; edited parameters require rechecking against measurements.json',
 horizontalStatus: 'satellite-ruler-checked-local-layout-adjusted',
 verticalStatus: 'estimated-not-measured',
 source: 'references/scale-calibration/REPORT.md',
 imageryDate: 'unknown',
 worldUnits: 'metres',
 globalScaleFactor: 1,
 columnCentreSpacing: 116,
 columnSpacingUncertainty: 3,
};
export const COLUMN_X = SCALE_CALIBRATION.columnCentreSpacing / 2;
// Retain each facade-relative feature's prior offset. These positions are inferred,
// not individually measured from the satellite image.
export const COLUMN_SHIFT = COLUMN_X - 52;
export const CALIBRATED_LAYOUT = {
 westWalkX: -20 - COLUMN_SHIFT,
 eastLampX: 15.3 + COLUMN_SHIFT,
 eastKerbX: [14.6 + COLUMN_SHIFT, 22.65 + COLUMN_SHIFT],
};
