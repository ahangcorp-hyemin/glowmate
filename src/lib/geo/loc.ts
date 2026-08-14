// 클라이언트 위치 기억(localStorage) — 한 번 허용/선택한 위치를 서비스 전체가 자동 사용.
export interface SavedLoc { lat: number; lng: number; label: string }

const KEY = "gm:loc";

export function saveLoc(loc: SavedLoc): void {
  try { localStorage.setItem(KEY, JSON.stringify(loc)); } catch {}
}

export function loadLoc(): SavedLoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedLoc;
    return typeof v?.lat === "number" && typeof v?.lng === "number" ? v : null;
  } catch { return null; }
}
