/** Local metre-scale authoring target, NOT a measured statue.
 * U05 00:00/00:07/00:14: large seated lion, no tall visible pedestal.
 * Nearby building levels and HKU letters are at different depth and are not rulers. */
export const LION={
 bodyHeight:4.8, // U06 02:04: user estimates 4–5 m; supersedes the prior 5.8 m authoring guess
 support:{width:3.5,depth:2.0,height:.12}, // low hidden support, not an asserted stone plinth
 x:0,z:76,groundY:.13,yaw:0,
 source:'U05 three angles + U06 IMG_4347 02:00–02:08: user estimates 4–5 m',
 uncertainty:'Body and support sizes provisional; no same-depth object of verified size. Body uniformly scaled from measured geometry bounds.',
};

// Ratios measured from the unchanged authored body geometry; all body axes use one scale.
export const lionBodySize=()=>({width:LION.bodyHeight*(3.0753396715727317/4.564799997711181),depth:LION.bodyHeight*(1.7520000128746034/4.564799997711181),zOffset:LION.bodyHeight*(.228/4.564799997711181)});
