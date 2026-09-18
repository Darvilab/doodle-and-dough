import { OrderState, ToppingId } from '../types/pizza';
import { SAUCE_NEED } from '../constants/catalog';

export interface PizzaScoreBreakdown {
  score: number; // 1.0 to 10.0
  sauceScore: number; // 0 to 2.5
  cheeseScore: number; // 0 to 2.5
  bakeScore: number; // 0 to 2.5
  toppingScore: number; // 0 to 2.5
  feedback: string;
  badge: string;
}

/**
 * Calculates a fully reproducible, deterministic score from 1.0 to 10.0
 * based on physics, coverage, bake timing, and topping placement.
 */
export function calculatePizzaScore(
  state: OrderState,
  sauceCoverage: number,
  cheeseCoverage: number,
  doneness: number
): PizzaScoreBreakdown {
  // 1. Sauce Coverage Score (Max 2.5)
  const sauceRatio = Math.min(1.2, sauceCoverage / SAUCE_NEED);
  let sauceScore: number;
  if (sauceRatio < 0.5) {
    sauceScore = 1.0 + sauceRatio * 2;
  } else if (sauceRatio < 0.95) {
    sauceScore = 2.0 + (sauceRatio - 0.5) * 1.1;
  } else if (sauceRatio > 1.15) {
    sauceScore = 2.3;
  } else {
    sauceScore = 2.5;
  }

  // 2. Cheese Blanket Score (Max 2.5)
  const cheeseTarget = state.extraCheese ? 0.72 : 0.58;
  const cheeseRatio = Math.min(1.2, cheeseCoverage / cheeseTarget);
  let cheeseScore: number;
  if (cheeseRatio < 0.5) {
    cheeseScore = 1.0 + cheeseRatio * 2;
  } else if (cheeseRatio < 0.95) {
    cheeseScore = 2.0 + (cheeseRatio - 0.5) * 1.1;
  } else {
    cheeseScore = 2.5;
  }

  // 3. Bake Precision Score (Max 2.5)
  let bakeScore: number;
  if (state.bakeQ === 'Perfect') {
    bakeScore = 2.5;
  } else if (state.bakeQ === 'Well done') {
    bakeScore = 2.3;
  } else if (state.bakeQ === 'Pale') {
    bakeScore = 1.9;
  } else if (state.bakeQ === 'Charred') {
    bakeScore = 1.4;
  } else if (state.bakeQ === 'Underbaked') {
    bakeScore = 1.2;
  } else {
    const diff = Math.abs(doneness - 0.75);
    bakeScore = Math.max(1.0, 2.5 - diff * 2.8);
  }

  // 4. Topping Distribution & Balance Score (Max 2.5)
  let totalToppingCount = 0;
  let radialSpreadSum = 0;
  let toppingVarieties = 0;

  for (const tid of Object.keys(state.placed) as ToppingId[]) {
    const items = state.placed[tid];
    if (items && items.length > 0) {
      toppingVarieties++;
      totalToppingCount += items.length;
      for (const item of items) {
        const dist = Math.hypot(item.x, item.y);
        if (dist >= 0.12 && dist <= 0.85) {
          radialSpreadSum += 1;
        } else {
          radialSpreadSum += 0.5;
        }
      }
    }
  }

  let toppingScore: number;
  if (totalToppingCount === 0) {
    toppingScore = 2.4;
  } else {
    const distributionRatio = radialSpreadSum / totalToppingCount;
    const varietyBonus = Math.min(0.4, (toppingVarieties - 1) * 0.1);
    toppingScore = Math.min(2.5, 1.8 * distributionRatio + 0.3 + varietyBonus);
  }

  // Raw score out of 10.0
  const rawScore = sauceScore + cheeseScore + bakeScore + toppingScore;
  const clampedScore = Math.max(1.0, Math.min(10.0, rawScore));
  const finalScore = Math.round(clampedScore * 10) / 10;

  let feedback: string;
  let badge: string;

  if (finalScore >= 9.5) {
    feedback = 'Flawless balance, crust blister & melted perfection!';
    badge = 'Master Pizzaiolo 🏆';
  } else if (finalScore >= 8.5) {
    feedback = 'Golden bake with delicious, evenly spread flavor!';
    badge = 'Artisan Baker ⭐';
  } else if (finalScore >= 7.0) {
    feedback = 'Hearty & flavorful with rustic charm!';
    badge = 'Skilled Crafter 🍕';
  } else {
    feedback = 'Wild & creative experiment!';
    badge = 'Kitchen Adventurer 🔥';
  }

  return {
    score: finalScore,
    sauceScore: Math.round(sauceScore * 10) / 10,
    cheeseScore: Math.round(cheeseScore * 10) / 10,
    bakeScore: Math.round(bakeScore * 10) / 10,
    toppingScore: Math.round(toppingScore * 10) / 10,
    feedback,
    badge
  };
}
