import { OrderState, SceneTopping } from '../types/pizza';
import { CATALOG } from '../constants/catalog';

const STORAGE_KEY = 'doodle-dough:draft-order:v1';

interface DraftOrder {
  state: OrderState;
  sceneMirror: SceneTopping[];
}

const STAGES = new Set(['start', 'base', 'sauce', 'cheese', 'top', 'bake', 'review']);
const ZONES = new Set(['whole', 'left', 'right']);

/** Guards that a parsed draft matches the current OrderState shape and catalog ids. */
function isValidDraft(data: unknown): data is DraftOrder {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<DraftOrder>;
  const s = d.state;
  if (!s || typeof s !== 'object') return false;
  if (!STAGES.has(s.stage as string)) return false;
  if (!(s.sizeId in CATALOG.sizes)) return false;
  if (!(s.crustId in CATALOG.crusts)) return false;
  if (!(s.sauceId in CATALOG.sauces)) return false;
  if (!(s.cheeseId in CATALOG.cheeses)) return false;
  if (typeof s.cheeseUnits !== 'number' || typeof s.extraCheese !== 'boolean') return false;
  if (!ZONES.has(s.zone as string)) return false;
  if (typeof s.doneness !== 'number' || typeof s.pulled !== 'boolean') return false;
  if (!s.placed || typeof s.placed !== 'object') return false;
  if (!Array.isArray(d.sceneMirror)) return false;
  for (const item of Object.values(s.placed)) {
    if (!Array.isArray(item)) return false;
    for (const p of item) {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || !ZONES.has(p.zone)) {
        return false;
      }
    }
  }
  return true;
}

export function loadDraft(): DraftOrder | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) return null;
    if (parsed.state.stage === 'start') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(state: OrderState, sceneMirror: SceneTopping[]): void {
  try {
    if (state.stage === 'start') {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, sceneMirror }));
  } catch {
    // Storage may be unavailable (private mode / quota) — drafts are best-effort.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
