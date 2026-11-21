export const CDS1_KEYS = 'ILOVECDS';

interface KeyboardProgress {
  seated: string[];
  online: boolean;
}

const progressKey = (deviceId: string) => 'hku.b4.keyboard.' + deviceId;

export function readKeyboardProgress(deviceId: string): KeyboardProgress {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(progressKey(deviceId)) ?? 'null');
    if (saved && typeof saved === 'object' && 'seated' in saved && Array.isArray(saved.seated)) {
      const accepted = saved.seated;
      const seated = [...CDS1_KEYS].filter(key => accepted.includes(key));
      return {seated, online: 'online' in saved && saved.online === true && seated.length === CDS1_KEYS.length};
    }
  } catch { /* The chapter remains playable without storage. */ }
  return {seated: [], online: false};
}

export function saveKeyboardProgress(deviceId: string, acceptedKeys: string[], online: boolean): void {
  const previous = readKeyboardProgress(deviceId);
  const seated = [...CDS1_KEYS].filter(key => previous.seated.includes(key) || acceptedKeys.includes(key));
  try {
    localStorage.setItem(progressKey(deviceId), JSON.stringify({
      seated, online: previous.online || (online && seated.length === CDS1_KEYS.length),
    }));
  } catch { /* The current scene retains its in-memory progress. */ }
}
