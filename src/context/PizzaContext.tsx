import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import {
  BakeQuality,
  CanPlaceResult,
  CrustId,
  CheeseId,
  LineItem,
  OrderBlueprint,
  OrderState,
  PlacedToppingItem,
  SauceId,
  SceneTopping,
  SizeId,
  Stage,
  ToppingId,
  Zone,
  ZoneCount
} from '../types/pizza';
import { CATALOG, TOPSIZE } from '../constants/catalog';
import { getIsMuted, setMuted, stopRumble } from '../services/audio';

interface PizzaContextValue {
  state: OrderState;
  isMuted: boolean;
  toastMessage: string | null;
  showOrderModal: boolean;
  sceneMirror: SceneTopping[];
  setStage: (stage: Stage) => void;
  setSizeId: (sizeId: SizeId) => void;
  setCrustId: (crustId: CrustId) => void;
  setSauceId: (sauceId: SauceId) => void;
  setCheeseId: (cheeseId: CheeseId) => void;
  setCheeseUnits: (units: number) => void;
  addCheeseUnit: () => void;
  removeCheeseUnit: () => void;
  setExtraCheese: (extra: boolean) => void;
  setZone: (zone: Zone) => void;
  setDoneness: (doneness: number | ((prev: number) => number)) => void;
  setBakeQ: (bakeQ: BakeQuality | null) => void;
  setPulled: (pulled: boolean) => void;
  toggleMute: () => void;
  showToast: (msg: string) => void;
  setShowOrderModal: (show: boolean) => void;
  unitsTotal: (id: ToppingId) => number;
  zoneCount: (id: ToppingId) => ZoneCount;
  grams: () => number;
  varieties: () => number;
  canPlace: (id: ToppingId) => CanPlaceResult;
  commitTopping: (
    id: ToppingId,
    zone: Zone,
    x?: number,
    y?: number,
    onSpawnPlaced?: (charge: number, lx: number, ly: number) => void
  ) => number;
  addOneTopping: (
    id: ToppingId,
    onSuccessSpawn?: (charge: number, lx: number, ly: number) => void
  ) => CanPlaceResult;
  removeOneTopping: (id: ToppingId) => PlacedToppingItem[] | PlacedToppingItem | null;
  lines: () => LineItem[];
  subtotal: () => number;
  blueprint: () => string;
  resetState: () => void;
}

const initialState: OrderState = {
  stage: 'start',
  sizeId: '12',
  crustId: 'thin',
  sauceId: 'classic',
  cheeseId: 'blend',
  cheeseUnits: 1,
  extraCheese: false,
  zone: 'whole',
  placed: {},
  doneness: 0,
  bakeQ: null,
  pulled: false
};

const PizzaContext = createContext<PizzaContextValue | null>(null);

export const PizzaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OrderState>(initialState);
  const [muted, setMutedState] = useState<boolean>(getIsMuted());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState<boolean>(false);
  const [sceneMirror, setSceneMirror] = useState<SceneTopping[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }, [muted]);

  const setStage = useCallback((stage: Stage) => {
    setState((prev) => ({ ...prev, stage }));
  }, []);

  const setSizeId = useCallback((sizeId: SizeId) => {
    setState((prev) => ({ ...prev, sizeId }));
  }, []);

  const setCrustId = useCallback((crustId: CrustId) => {
    setState((prev) => ({ ...prev, crustId }));
  }, []);

  const setSauceId = useCallback((sauceId: SauceId) => {
    setState((prev) => ({ ...prev, sauceId }));
  }, []);

  const setCheeseId = useCallback((cheeseId: CheeseId) => {
    setState((prev) => ({ ...prev, cheeseId }));
  }, []);

  const setCheeseUnits = useCallback((units: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(units)));
    setState((prev) => ({
      ...prev,
      cheeseUnits: clamped,
      extraCheese: clamped > 1
    }));
  }, []);

  const addCheeseUnit = useCallback(() => {
    setState((prev) => {
      const next = Math.min(10, (prev.cheeseUnits || 1) + 1);
      return {
        ...prev,
        cheeseUnits: next,
        extraCheese: next > 1
      };
    });
  }, []);

  const removeCheeseUnit = useCallback(() => {
    setState((prev) => {
      const next = Math.max(1, (prev.cheeseUnits || 1) - 1);
      return {
        ...prev,
        cheeseUnits: next,
        extraCheese: next > 1
      };
    });
  }, []);

  const setExtraCheese = useCallback((extraCheese: boolean) => {
    setState((prev) => ({
      ...prev,
      extraCheese,
      cheeseUnits: extraCheese ? Math.max(2, prev.cheeseUnits || 1) : 1
    }));
  }, []);

  const setZone = useCallback((zone: Zone) => {
    setState((prev) => ({ ...prev, zone }));
  }, []);

  const setDoneness = useCallback((doneness: number | ((prev: number) => number)) => {
    setState((prev) => ({
      ...prev,
      doneness: typeof doneness === 'function' ? doneness(prev.doneness) : doneness
    }));
  }, []);

  const setBakeQ = useCallback((bakeQ: BakeQuality | null) => {
    setState((prev) => ({ ...prev, bakeQ }));
  }, []);

  const setPulled = useCallback((pulled: boolean) => {
    setState((prev) => ({ ...prev, pulled }));
  }, []);

  const getUnits = useCallback(
    (id: ToppingId): { unitId: string; zone: Zone }[] => {
      const p = state.placed[id] || [];
      const seen = new Set<string>();
      const units: { unitId: string; zone: Zone }[] = [];
      for (const item of p) {
        const uId = item.unitId || `${item.x}_${item.y}`;
        if (!seen.has(uId)) {
          seen.add(uId);
          units.push({ unitId: uId, zone: item.zone });
        }
      }
      return units;
    },
    [state.placed]
  );

  const unitsTotal = useCallback(
    (id: ToppingId): number => {
      return getUnits(id).length;
    },
    [getUnits]
  );

  const zoneCount = useCallback(
    (id: ToppingId): ZoneCount => {
      const units = getUnits(id);
      let w = 0,
        l = 0;
      for (const u of units) {
        if (u.zone === 'whole') w++;
        else if (u.zone === 'left') l++;
      }
      return { whole: w, left: l, right: units.length - w - l };
    },
    [getUnits]
  );

  const grams = useCallback((): number => {
    return CATALOG.toppings.reduce((acc, t) => {
      const z = zoneCount(t.id);
      const unitGrams = z.whole * t.g + Math.round((z.left + z.right) * (t.g / 2));
      return acc + unitGrams;
    }, 0);
  }, [zoneCount]);

  const varieties = useCallback((): number => {
    return CATALOG.toppings.filter((t) => unitsTotal(t.id) > 0).length;
  }, [unitsTotal]);

  const canPlace = useCallback(
    (id: ToppingId): CanPlaceResult => {
      const t = CATALOG.toppings.find((k) => k.id === id);
      if (!t) return { ok: false, reason: 'Unknown topping' };
      const n = unitsTotal(id);
      if (n >= t.max)
        return {
          ok: false,
          reason: `Max ${t.max} portions of ${t.label.toLowerCase()} — even-bake limit`
        };
      if (n === 0 && varieties() >= CATALOG.maxVarieties)
        return { ok: false, reason: '5 topping varieties max' };
      const addGrams = state.zone === 'whole' ? t.g : Math.round(t.g / 2);
      if (grams() + addGrams > CATALOG.maxGrams)
        return { ok: false, reason: 'Oven load full — remove something first' };
      return { ok: true };
    },
    [unitsTotal, varieties, grams, state.zone]
  );

  function generateHumanLikeDistribution(
    count: number,
    zone: Zone,
    id: ToppingId,
    existingPlaced: Record<string, PlacedToppingItem[]>,
    targetCenter?: { x: number; y: number } | null
  ): { x: number; y: number }[] {
    const sameItems = existingPlaced[id] || [];
    const allItems = Object.values(existingPlaced).flat();
    const batch: { x: number; y: number }[] = [];

    for (let i = 0; i < count; i++) {
      // If targetCenter provided (drag-and-drop), first item lands right at targetCenter
      if (targetCenter && i === 0) {
        let px = targetCenter.x;
        let py = targetCenter.y;
        const d = Math.hypot(px, py);
        if (d > 0.8) {
          px = (px / d) * 0.8;
          py = (py / d) * 0.8;
        }
        if (zone === 'left') px = Math.min(px, -0.08);
        else if (zone === 'right') px = Math.max(px, 0.08);
        batch.push({ x: +px.toFixed(3), y: +py.toFixed(3) });
        continue;
      }

      let bestPoint = { x: 0, y: 0 };
      let bestScore = -Infinity;
      const numCandidates = targetCenter ? 36 : 64;

      for (let c = 0; c < numCandidates; c++) {
        let candX: number;
        let candY: number;

        if (targetCenter) {
          // Generous, natural scatter around target center (min distance 0.22 so never clumping)
          const baseAngle = i * ((Math.PI * 2) / count) + (Math.random() - 0.5) * 0.75;
          const dist = 0.22 + Math.random() * 0.14;
          candX = targetCenter.x + Math.cos(baseAngle) * dist;
          candY = targetCenter.y + Math.sin(baseAngle) * dist;
        } else {
          // Stratified area-uniform radial distribution across whole pizza / half pizza
          const r = Math.sqrt(0.06 + Math.random() * 0.56); // radius in [0.24, 0.79]
          let a = Math.random() * Math.PI * 2;
          if (zone === 'left') a = Math.PI * 0.55 + Math.random() * Math.PI * 0.9;
          else if (zone === 'right') a = -Math.PI * 0.45 + Math.random() * Math.PI * 0.9;
          candX = Math.cos(a) * r;
          candY = Math.sin(a) * r;
        }

        // Keep within pizza boundary and zone constraints
        const cd = Math.hypot(candX, candY);
        if (cd > 0.8) {
          candX = (candX / cd) * 0.8;
          candY = (candY / cd) * 0.8;
        }
        if (zone === 'left') candX = Math.min(candX, -0.08);
        else if (zone === 'right') candX = Math.max(candX, 0.08);

        // 1. Repulsion from same topping (including pieces in current batch)
        let minSameDist = Infinity;
        const allSame = [...sameItems, ...batch];
        for (const p of allSame) {
          const dist = Math.hypot(candX - p.x, candY - p.y);
          if (dist < minSameDist) minSameDist = dist;
        }
        if (minSameDist === Infinity) minSameDist = 1.0;

        // 2. Soft repulsion from other toppings
        let minOtherDist = Infinity;
        for (const p of allItems) {
          const dist = Math.hypot(candX - p.x, candY - p.y);
          if (dist < minOtherDist) minOtherDist = dist;
        }
        if (minOtherDist === Infinity) minOtherDist = 1.0;

        // 3. Radial balance sweet spot preference (around 0.48)
        const radDist = Math.hypot(candX, candY);
        const radScore = 1.0 - Math.abs(radDist - 0.48) * 0.6;

        const totalScore =
          minSameDist * 3.5 + minOtherDist * 1.0 + radScore * 0.2 + Math.random() * 0.06;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestPoint = { x: +candX.toFixed(3), y: +candY.toFixed(3) };
        }
      }

      batch.push(bestPoint);
    }

    return batch;
  }

  const commitTopping = useCallback(
    (
      id: ToppingId,
      zone: Zone,
      x?: number,
      y?: number,
      onSpawnPlaced?: (charge: number, lx: number, ly: number) => void
    ): number => {
      const t = CATALOG.toppings.find((k) => k.id === id)!;
      const count =
        zone === 'whole' ? t.itemsPerUnit || 1 : Math.max(1, Math.round((t.itemsPerUnit || 1) / 2));

      const targetCenter = x !== undefined && y !== undefined ? { x, y } : null;
      const positions = generateHumanLikeDistribution(count, zone, id, state.placed, targetCenter);

      const unitId = `u_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newPlaced: PlacedToppingItem[] = [];
      const newScene: SceneTopping[] = [];

      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        newPlaced.push({
          unitId,
          zone,
          x: pos.x,
          y: pos.y
        });

        newScene.push({
          unitId,
          type: id,
          x: pos.x,
          y: pos.y,
          zone,
          rot: Math.random() * Math.PI * 2,
          s: TOPSIZE[id] * (0.88 + Math.random() * 0.24),
          born: performance.now() / 1000
        });
      }

      setState((prev) => {
        const nextPlaced = { ...prev.placed };
        nextPlaced[id] = [...(nextPlaced[id] || []), ...newPlaced];
        return { ...prev, placed: nextPlaced };
      });

      setSceneMirror((prev) => [...prev, ...newScene]);

      const charge = zone === 'whole' ? t.price : Math.round(t.price / 2);
      if (onSpawnPlaced && positions.length > 0) {
        onSpawnPlaced(charge, positions[0].x, positions[0].y);
      }

      return charge;
    },
    [state.placed]
  );

  const removeOneTopping = useCallback((id: ToppingId): PlacedToppingItem[] | null => {
    let removedItems: PlacedToppingItem[] = [];
    let targetUnitId: string | undefined;

    setState((prev) => {
      const p = prev.placed[id];
      if (!p || !p.length) return prev;

      const lastItem = p[p.length - 1];
      targetUnitId = lastItem.unitId;

      const nextPlaced = { ...prev.placed };
      if (targetUnitId) {
        removedItems = p.filter((item) => item.unitId === targetUnitId);
        const remaining = p.filter((item) => item.unitId !== targetUnitId);
        if (remaining.length) {
          nextPlaced[id] = remaining;
        } else {
          delete nextPlaced[id];
        }
      } else {
        const t = CATALOG.toppings.find((k) => k.id === id);
        const countToRemove = t?.itemsPerUnit || 1;
        const nextList = [...p];
        removedItems = nextList.splice(Math.max(0, nextList.length - countToRemove));
        if (nextList.length) {
          nextPlaced[id] = nextList;
        } else {
          delete nextPlaced[id];
        }
      }
      return { ...prev, placed: nextPlaced };
    });

    setSceneMirror((prev) => {
      if (targetUnitId) {
        return prev.filter((m) => !(m.type === id && m.unitId === targetUnitId));
      }
      const t = CATALOG.toppings.find((k) => k.id === id);
      const countToRemove = t?.itemsPerUnit || 1;
      let removed = 0;
      const result = [...prev];
      for (let i = result.length - 1; i >= 0 && removed < countToRemove; i--) {
        if (result[i].type === id) {
          result.splice(i, 1);
          removed++;
        }
      }
      return result;
    });

    return removedItems.length > 0 ? removedItems : null;
  }, []);

  const addOneTopping = useCallback(
    (
      id: ToppingId,
      onSuccessSpawn?: (charge: number, lx: number, ly: number) => void
    ): CanPlaceResult => {
      const check = canPlace(id);
      if (!check.ok) return check;

      const z = state.zone;
      commitTopping(id, z, undefined, undefined, (charge, px, py) => {
        if (onSuccessSpawn) {
          onSuccessSpawn(charge, px, py);
        }
      });

      return { ok: true };
    },
    [canPlace, commitTopping, state.zone]
  );

  const lines = useCallback((): LineItem[] => {
    const sz = CATALOG.sizes[state.sizeId];
    const cr = CATALOG.crusts[state.crustId];
    const out: LineItem[] = [
      [sz.label + ' pizza', sz.price, undefined, undefined, 'base'],
      [cr.label + ' crust', cr.price, undefined, undefined, 'base']
    ];
    if (state.sauceId) {
      out.push([
        CATALOG.sauces[state.sauceId].label + ' sauce',
        CATALOG.sauces[state.sauceId].price,
        undefined,
        undefined,
        'sauce'
      ]);
    }
    if (state.cheeseId && CATALOG.cheeses[state.cheeseId]) {
      const ch = CATALOG.cheeses[state.cheeseId];
      out.push([ch.label + ' cheese', ch.price, undefined, undefined, 'cheese']);
    }
    const units = state.cheeseUnits || 1;
    if (units > 1) {
      const extraCount = units - 1;
      const extraCost = extraCount * CATALOG.extraCheesePrice;
      const label =
        extraCount === 1
          ? 'Extra cheese (2 layers)'
          : `Extra cheese ×${extraCount} (${units} layers)`;
      out.push([label, extraCost, undefined, undefined, 'cheese']);
    }
    for (const t of CATALOG.toppings) {
      const z = zoneCount(t.id);
      const n = z.whole + z.left + z.right;
      if (!n) continue;
      const cents = t.price * z.whole + Math.round(t.price / 2) * (z.left + z.right);
      const zs =
        n === z.whole ? 'whole' : z.left && z.right ? 'split' : z.left ? 'left half' : 'right half';
      out.push([t.label + ' ×' + n, cents, zs, t.id, 'top']);
    }
    return out;
  }, [state.sizeId, state.crustId, state.sauceId, state.cheeseId, state.cheeseUnits, zoneCount]);

  const subtotal = useCallback((): number => {
    return lines().reduce((acc, l) => acc + l[1], 0);
  }, [lines]);

  const blueprint = useCallback((): string => {
    const orderData: OrderBlueprint = {
      orderId: 'draft_' + Math.random().toString(36).slice(2, 8),
      configuration: {
        size: state.sizeId,
        crust: state.crustId,
        sauce: state.sauceId,
        cheese: state.cheeseId,
        cheeseUnits: state.cheeseUnits || 1,
        extraCheese: (state.cheeseUnits || 1) > 1,
        toppings: CATALOG.toppings
          .filter((t) => unitsTotal(t.id) > 0)
          .map((t) => ({ id: t.id, units: zoneCount(t.id) }))
      },
      preferences: {
        bake: state.bakeQ || 'standard'
      }
    };
    return JSON.stringify(orderData, null, 2);
  }, [state, unitsTotal, zoneCount]);

  const resetState = useCallback(() => {
    stopRumble();
    setState(initialState);
    setSceneMirror([]);
    setShowOrderModal(false);
  }, []);

  const value = useMemo(
    (): PizzaContextValue => ({
      state,
      isMuted: muted,
      toastMessage,
      showOrderModal,
      sceneMirror,
      setStage,
      setSizeId,
      setCrustId,
      setSauceId,
      setCheeseId,
      setCheeseUnits,
      addCheeseUnit,
      removeCheeseUnit,
      setExtraCheese,
      setZone,
      setDoneness,
      setBakeQ,
      setPulled,
      toggleMute,
      showToast,
      setShowOrderModal,
      unitsTotal,
      zoneCount,
      grams,
      varieties,
      canPlace,
      commitTopping,
      addOneTopping,
      removeOneTopping,
      lines,
      subtotal,
      blueprint,
      resetState
    }),
    [
      state,
      muted,
      toastMessage,
      showOrderModal,
      sceneMirror,
      setStage,
      setSizeId,
      setCrustId,
      setSauceId,
      setCheeseId,
      setCheeseUnits,
      addCheeseUnit,
      removeCheeseUnit,
      setExtraCheese,
      setZone,
      setDoneness,
      setBakeQ,
      setPulled,
      toggleMute,
      showToast,
      setShowOrderModal,
      unitsTotal,
      zoneCount,
      grams,
      varieties,
      canPlace,
      commitTopping,
      addOneTopping,
      removeOneTopping,
      lines,
      subtotal,
      blueprint,
      resetState
    ]
  );

  return <PizzaContext.Provider value={value}>{children}</PizzaContext.Provider>;
};

export function usePizza(): PizzaContextValue {
  const ctx = useContext(PizzaContext);
  if (!ctx) {
    throw new Error('usePizza must be used within a PizzaProvider');
  }
  return ctx;
}
