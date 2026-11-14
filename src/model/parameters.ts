/**
 * CDS-1 visual reconstruction, 2026-11-12. Metres, Y up; entrance faces +Z.
 * +Z is a model-local axis, NOT surveyed north. See references/MODELING_BASIS.md.
 * The candidate plan is not an as-built drawing. All metric values are editable estimates.
 */
export const DEFAULT_PARAMETERS = {
  width: 59.7, depth: 45, height: 66.15, floors: 14,
  roofScreenHeight: 3.15,
  frontBays: 25, sideBays: 18,
  sideRecessWidth: 9.5, sideRecessDepth: 3.2,
  wideFin: 1.05, narrowFin: 0.16, finProjection: 0.30,
  bandThickness: 0.22,
  entranceX: 0, entranceWidth: 24, entranceHeight: 9,
  doorWidth: 8.4, doorHeight: 3.7, revolvingRadius: 1.25,
  canopyWidth: 19.5, canopyDepth: 3.6, canopyHeight: 5.1,
  plinthHeight: 0.18,
  environmentSize: 140,
  // Surrounding geometry is a spatial cue, not a second fully reconstructed asset.
  contextGap: 12, contextHeight: 15,
} as const;
export type ModelParameters = { -readonly [K in keyof typeof DEFAULT_PARAMETERS]: number };
export const PARAMETER_EVIDENCE = {
  dimensions: '水平核对：SM01/SM02 高德卫星测距约 60±2 × 45±2 m，保留 P01 的 59.70×45.00 m。H66.15 仍暂定（约±20%），不由卫星屋顶测距确认。',
  floors: '暂定：P01 标注 14F；实景楼层分隔与此大致相容。不能仅依据 14 楼办公室信息推断总层数。',
  facade: '已确认构件类型和分段节奏：R02 官方 C 标注、R04 实景航拍；分格数量与构件厚度为照片估计。',
  entrance: '已确认入口形式：R01 门牌、旋转门、两侧门、薄雨棚。尺寸以照片中人高作粗略参照，约 ±25%。',
  roof: '合理推断：R04 中远处目标塔楼屋顶可见机房/围护；具体设备尺寸、数量和排列暂定。',
  environment: '只保留 R01 入口铺装绿化以及 R02 礼堂方向的低细节体块；间距与高程暂定。',
};
export function validateParameters(p: ModelParameters) {
  const ranges: Partial<Record<keyof ModelParameters, [number,number]>> = {
    width:[35,85],depth:[25,65],height:[35,90],floors:[8,20],frontBays:[12,40],sideBays:[8,30],
    canopyWidth:[8,30],canopyDepth:[1.5,7],canopyHeight:[3,8],entranceWidth:[12,32],
  };
  for (const [key, [lo,hi]] of Object.entries(ranges)) {
    const v=p[key as keyof ModelParameters];
    if (!Number.isFinite(v)||v<lo||v>hi) throw new Error(`${key} 应在 ${lo}–${hi} 之间`);
  }
  for(const k of ['floors','frontBays','sideBays'] as const) if(!Number.isInteger(p[k])) throw new Error(`${k} 必须为整数`);
  if(p.sideRecessWidth>=p.depth-8||p.sideRecessDepth>=p.width/3) throw new Error('内凹尺寸超出主体范围');
}
