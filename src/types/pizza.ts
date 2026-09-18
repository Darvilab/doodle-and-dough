export type Stage = 'start' | 'base' | 'sauce' | 'cheese' | 'top' | 'bake' | 'review';

export type SizeId = '8' | '12' | '15' | '10' | '14';
export type CrustId = 'thin' | 'pan' | 'stuffed';
export type SauceId = 'classic' | 'spicy' | 'pesto' | 'bechamel' | 'bbq';
export type CheeseId = 'blend' | 'mozzarella' | 'yak' | 'kanchan';
export type ToppingId = 'pep' | 'chick' | 'mush' | 'jalap' | 'prosc' | 'basil' | 'olive' | 'onion';
export type Zone = 'whole' | 'left' | 'right';
export type BakeQuality = 'Underbaked' | 'Pale' | 'Perfect' | 'Well done' | 'Charred';

export interface SizeOption {
  label: string;
  price: number;
  f: number;
}

export interface CrustOption {
  label: string;
  price: number;
  rim: number;
  shine: number;
  desc?: string;
  badge?: string;
}

export interface SauceOption {
  label: string;
  price: number;
  color: string;
}

export interface CheeseOption {
  label: string;
  price: number;
  desc: string;
  badge?: string;
  colors: string[];
}

export interface ToppingOption {
  id: ToppingId;
  label: string;
  price: number;
  max: number;
  g: number;
  category?: 'veg' | 'nonveg';
  itemsPerUnit?: number;
}

export interface ArtisanPreset {
  id: string;
  name: string;
  category: 'veg' | 'nonveg';
  desc: string;
  sauceId: SauceId;
  toppings: { id: ToppingId; count: number }[];
  badge?: string;
}

export interface PlacedToppingItem {
  zone: Zone;
  x: number;
  y: number;
  unitId?: string;
}

export interface SceneTopping {
  type: ToppingId;
  x: number;
  y: number;
  zone: Zone;
  rot: number;
  s: number;
  born: number;
  unitId?: string;
}

export interface OrderState {
  stage: Stage;
  sizeId: SizeId;
  crustId: CrustId;
  sauceId: SauceId;
  cheeseId: CheeseId;
  cheeseUnits: number; // 1 to 10 layers
  extraCheese: boolean;
  zone: Zone;
  placed: Record<string, PlacedToppingItem[]>;
  doneness: number;
  bakeQ: BakeQuality | null;
  pulled: boolean;
}

export interface ZoneCount {
  whole: number;
  left: number;
  right: number;
}

export interface CanPlaceResult {
  ok: boolean;
  reason?: string;
}

export interface OrderBlueprint {
  orderId: string;
  configuration: {
    size: SizeId;
    crust: CrustId;
    sauce: SauceId;
    cheese: CheeseId;
    cheeseUnits: number;
    extraCheese: boolean;
    toppings: {
      id: ToppingId;
      units: ZoneCount;
    }[];
  };
  preferences: {
    bake: string;
  };
}

export type LineItem = [string, number, string?, ToppingId?, Stage?];
