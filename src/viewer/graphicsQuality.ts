export type GraphicsQuality = 'auto' | 'low';

const storageKey = 'hku.campus.graphics-quality.v1';

export function getGraphicsQuality(): GraphicsQuality {
  const override = new URLSearchParams(location.search).get('quality');
  if (override === 'auto' || override === 'low') return override;
  try { return localStorage.getItem(storageKey) === 'low' ? 'low' : 'auto'; }
  catch { return 'auto'; }
}

export function setGraphicsQuality(quality: GraphicsQuality) {
  try { localStorage.setItem(storageKey, quality); }
  catch { /* Menu links also carry the choice when storage is unavailable. */ }
}

export function graphicsPixelRatio(
  quality: GraphicsQuality, width: number, height: number, screenRatio: number, maxRatio: number,
) {
  const low = quality === 'low';
  const pixelBudget = low ? 1280 * 720 : 2048 * 1280;
  return Math.min(screenRatio, low ? 0.8 : maxRatio, Math.sqrt(pixelBudget / (width * height)));
}
