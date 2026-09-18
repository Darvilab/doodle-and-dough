import React, { useEffect, useState, useRef } from 'react';
import { usePizza } from '../context/PizzaContext';
import { fmt, SAUCE_NEED } from '../constants/catalog';
import { SND } from '../services/audio';

interface BottomBarProps {
  visible: boolean;
  spread: number;
  sauceCoverage: number;
  cheeseCoverage: number;
  sauceDone: boolean;
  cheeseDone: boolean;
  isBaking: boolean;
  isTossing: boolean;
  reviewReady: boolean;
  onCtaClick: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  visible,
  spread,
  sauceCoverage,
  cheeseCoverage,
  sauceDone,
  cheeseDone,
  isBaking,
  isTossing,
  reviewReady,
  onCtaClick
}) => {
  const { state, subtotal } = usePizza();
  const currentTotal = subtotal();
  const [popAnim, setPopAnim] = useState(false);
  const prevTotalRef = useRef(currentTotal);

  useEffect(() => {
    if (prevTotalRef.current !== currentTotal) {
      // Play coin sound when total increases
      if (currentTotal > prevTotalRef.current && prevTotalRef.current > 0) {
        SND.coin();
      }
      prevTotalRef.current = currentTotal;
      setPopAnim(false);
      const id = requestAnimationFrame(() => setPopAnim(true));
      return () => cancelAnimationFrame(id);
    }
  }, [currentTotal]);

  const cheeseNeed = state.extraCheese ? 0.72 : 0.58;

  let ctaText = '…';
  let ctaEnabled = true;
  let isUrgentBake = false;

  if (state.stage === 'base') {
    if (isTossing) {
      ctaText = '🌀 Tossing dough…';
      ctaEnabled = false;
    } else if (spread >= 1) {
      ctaText = 'Toss the Dough 🍕';
      ctaEnabled = true;
    } else {
      ctaText = `Roll dough (${Math.round(spread * 100)}%)`;
      ctaEnabled = false;
    }
  } else if (state.stage === 'sauce') {
    const pct = Math.min(100, Math.round((sauceCoverage / SAUCE_NEED) * 100));
    const isDone = sauceDone || sauceCoverage >= SAUCE_NEED || pct >= 100;
    ctaText = isDone ? 'To the Cheese →' : `Swirl sauce (${pct}%)`;
    ctaEnabled = isDone;
  } else if (state.stage === 'cheese') {
    const pct = Math.min(100, Math.round((cheeseCoverage / cheeseNeed) * 100));
    const isDone = cheeseDone || cheeseCoverage >= cheeseNeed || pct >= 100;
    ctaText = isDone ? 'Add Toppings →' : `Sprinkle cheese (${pct}%)`;
    ctaEnabled = isDone;
  } else if (state.stage === 'top') {
    ctaText = state.pulled ? 'Review Order →' : 'Fire the Oven → 🔥';
    ctaEnabled = true;
  } else if (state.stage === 'bake') {
    if (state.pulled) {
      ctaText = 'Inspect & Score → ⭐';
      ctaEnabled = reviewReady;
    } else if (!isBaking) {
      ctaText = 'Firing up oven…';
      ctaEnabled = false;
    } else {
      ctaText = '🔥 PULL IT OUT! 🔥';
      ctaEnabled = true;
      isUrgentBake = true;
    }
  } else if (state.stage === 'review') {
    ctaText = 'Order My Creation 🍕✨';
    ctaEnabled = true;
  }

  const btnClasses = [
    'btn',
    'game-cta-btn',
    ctaEnabled ? 'ready-pulse' : '',
    isUrgentBake ? 'urgent-flame' : ''
  ].filter(Boolean).join(' ');

  return (
    <div id="bottombar" className={visible ? 'show' : ''}>
      <div className="tot">
        <small>Total · pre-tax</small>
        <b id="totVal" className={popAnim ? 'pop' : ''}>
          {fmt(currentTotal)}
        </b>
      </div>
      <button
        className={btnClasses}
        id="ctaBtn"
        disabled={!ctaEnabled}
        onClick={onCtaClick}
      >
        <span className="cta-content">{ctaText}</span>
        {ctaEnabled && <span className="cta-sheen" />}
      </button>
    </div>
  );
};
