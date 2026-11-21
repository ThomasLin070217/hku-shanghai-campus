/** Metre-scale authoring target estimated from front, side and rear reference photos. */
export const LION = {
 bodyHeight:6.5,
 // IMG_4342 and phase2-07 show a ground-set inflatable, with no raised plinth.
 // Keep the existing estimated contact envelope for the campus and Boss.
 support:{width:1.75,depth:1.10,height:.025},
 x:0,z:76,groundY:.13,yaw:0,
 source:'New user-provided front, side and rear photographs of the seated inflatable lion',
 uncertainty:'6.5 m is a gameplay scale estimate. Photos establish silhouette and details but lack a verified scale reference.',
};

// Normalized bounds of the authored meshes, including the tail and sleeves.
export const lionBodySize = () => ({
 width:LION.bodyHeight*(3.98734/6.5),
 depth:LION.bodyHeight*(4.19954/6.5),
 xOffset:LION.bodyHeight*(.03116/6.5),
 zOffset:LION.bodyHeight*(-.04310/6.5),
});
