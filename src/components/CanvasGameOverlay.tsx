import React, { useState, useEffect, useRef } from 'react';
import { Stage } from '../types/pizza';
import { SAUCE_NEED } from '../constants/catalog';
import { SND, vib } from '../services/audio';

interface CanvasGameOverlayProps {
  stage: Stage;
  spread: number;
  isTossing: boolean;
  sauceCoverage: number;
  sauceDone: boolean;
  cheeseCoverage: number;
  cheeseDone: boolean;
  isBaking: boolean;
  liveDoneness: number;
  onToss: () => void;
}

export const CanvasGameOverlay: React.FC<CanvasGameOverlayProps> = ({
  stage,
  spread,
  isTossing,
  sauceCoverage,
  sauceDone,
  cheeseCoverage,
  cheeseDone,
  isBaking,
  liveDoneness,
  onToss
}) => {
  if (stage === 'start') return null;

  const spreadPct = Math.min(100, Math.round(spread * 100));
  const saucePct = Math.min(100, Math.round((sauceCoverage / SAUCE_NEED) * 100));
  const cheeseNeed = 0.58;
  const cheesePct = Math.min(100, Math.round((cheeseCoverage / cheeseNeed) * 100));
  const isPeakBake = isBaking && liveDoneness >= 0.72 && liveDoneness < 0.86;
  const isBurntBake = isBaking && liveDoneness >= 0.86;

  // Momentary splash flags
  const [showBaseMilestone, setShowBaseMilestone] = useState(false);
  const [showSauceMilestone, setShowSauceMilestone] = useState(false);
  const [showCheeseMilestone, setShowCheeseMilestone] = useState(false);
  const [showPeakMilestone, setShowPeakMilestone] = useState(false);

  // 1. Dough Spread 100% trigger (momentary 2.2s)
  const prevSpreadRef = useRef(spread);
  useEffect(() => {
    if (spread >= 1 && prevSpreadRef.current < 1 && stage === 'base') {
      setShowBaseMilestone(true);
      SND.ding();
      vib([20, 60, 20]);
      const timer = setTimeout(() => setShowBaseMilestone(false), 2200);
      return () => clearTimeout(timer);
    }
    prevSpreadRef.current = spread;
  }, [spread, stage]);

  // 2. Sauce 100% trigger (momentary 2s)
  const isSauceReady = sauceDone || saucePct >= 100;
  const prevSauceRef = useRef(isSauceReady);
  useEffect(() => {
    if (isSauceReady && !prevSauceRef.current && stage === 'sauce') {
      setShowSauceMilestone(true);
      SND.ding();
      vib([20, 50, 20]);
      const timer = setTimeout(() => setShowSauceMilestone(false), 2000);
      return () => clearTimeout(timer);
    }
    prevSauceRef.current = isSauceReady;
  }, [isSauceReady, stage]);

  // 3. Cheese 100% trigger (momentary 2s)
  const isCheeseReady = cheeseDone || cheesePct >= 100;
  const prevCheeseRef = useRef(isCheeseReady);
  useEffect(() => {
    if (isCheeseReady && !prevCheeseRef.current && stage === 'cheese') {
      setShowCheeseMilestone(true);
      SND.ding();
      vib([20, 50, 20]);
      const timer = setTimeout(() => setShowCheeseMilestone(false), 2000);
      return () => clearTimeout(timer);
    }
    prevCheeseRef.current = isCheeseReady;
  }, [isCheeseReady, stage]);

  // 4. Peak Bake trigger (momentary 1.8s)
  const prevPeakRef = useRef(isPeakBake);
  useEffect(() => {
    if (isPeakBake && !prevPeakRef.current && stage === 'bake') {
      setShowPeakMilestone(true);
      vib([30, 80, 30]);
      const timer = setTimeout(() => setShowPeakMilestone(false), 1800);
      return () => clearTimeout(timer);
    }
    prevPeakRef.current = isPeakBake;
  }, [isPeakBake, stage]);

  return (
    <div className="canvas-game-hud">
      {/* ── STAGE 1: DOUGH (CRUST) ── */}
      {stage === 'base' && (
        <>
          {spread < 1 && !isTossing && (
            <div className="dough-hud-pill">
              <span className="dough-hud-icon">🌾</span>
              <span className="dough-hud-title">Roll the Dough</span>
              <div className="dough-hud-track">
                <div className="dough-hud-fill" style={{ width: `${spreadPct}%` }} />
              </div>
              <b className="dough-hud-pct">{spreadPct}%</b>
            </div>
          )}

          {/* Momentary celebratory splash over the dough */}
          {showBaseMilestone && !isTossing && (
            <div
              className="momentary-splash-badge"
              onClick={onToss}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              title="Tap to toss!"
            >
              <div className="ready-badge-halo" />
              <div className="ready-badge-content">
                <span className="ready-sparkle">✨</span>
                <span className="ready-main-txt">READY TO TOSS! 🍕</span>
                <span className="ready-sparkle">✨</span>
              </div>
              <small className="ready-sub-txt">Tap here or button to toss!</small>
            </div>
          )}

          {isTossing && (
            <div className="momentary-splash-badge tossing-active">
              <div className="ready-badge-content">
                <span className="toss-spin-icon">🌀</span>
                <span className="ready-main-txt">Tossing Dough in the Air! ✨</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STAGE 2: SAUCE ── */}
      {stage === 'sauce' && (
        <>
          {!isSauceReady && (
            <div className="dough-hud-pill sauce-hud-pill">
              <span className="dough-hud-icon">🍅</span>
              <span className="dough-hud-title">Swirl Sauce</span>
              <div className="dough-hud-track">
                <div
                  className="dough-hud-fill sauce-fill"
                  style={{ width: `${saucePct}%` }}
                />
              </div>
              <b className="dough-hud-pct">{saucePct}%</b>
            </div>
          )}

          {/* Momentary celebration splash over pizza */}
          {showSauceMilestone && (
            <div className="momentary-splash-badge sauce-ready-badge">
              <div className="ready-badge-halo" />
              <div className="ready-badge-content">
                <span className="ready-sparkle">✨</span>
                <span className="ready-main-txt">SAUCED TO PERFECTION! 🍅</span>
                <span className="ready-sparkle">✨</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STAGE 3: CHEESE ── */}
      {stage === 'cheese' && (
        <>
          {!isCheeseReady && (
            <div className="dough-hud-pill cheese-hud-pill">
              <span className="dough-hud-icon">🧀</span>
              <span className="dough-hud-title">Sprinkle Cheese</span>
              <div className="dough-hud-track">
                <div
                  className="dough-hud-fill cheese-fill"
                  style={{ width: `${cheesePct}%` }}
                />
              </div>
              <b className="dough-hud-pct">{cheesePct}%</b>
            </div>
          )}

          {/* Momentary celebration splash over pizza */}
          {showCheeseMilestone && (
            <div className="momentary-splash-badge cheese-ready-badge">
              <div className="ready-badge-halo" />
              <div className="ready-badge-content">
                <span className="ready-sparkle">✨</span>
                <span className="ready-main-txt">MELTY &amp; READY! 🧀</span>
                <span className="ready-sparkle">✨</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STAGE 4: TOPPINGS ── */}
      {stage === 'top' && (
        <div className="dough-hud-pill top-hud-pill">
          <span className="dough-hud-icon">🍕</span>
          <span className="dough-hud-title">Drop Toppings on Pizza</span>
        </div>
      )}

      {/* ── STAGE 5: BAKE ── */}
      {stage === 'bake' && isBaking && (
        <>
          {showPeakMilestone && (
            <div className="momentary-splash-badge bake-peak-badge">
              <div className="ready-badge-content">
                <span className="flame-spark">🔥</span>
                <span className="ready-main-txt">PEAK CRISP! PULL NOW!</span>
                <span className="flame-spark">🔥</span>
              </div>
            </div>
          )}

          {isBurntBake && (
            <div className="momentary-splash-badge bake-burnt-badge">
              <div className="ready-badge-content">
                <span>⚠️</span>
                <span className="ready-main-txt">CHARRED! PULL OUT!</span>
                <span>⚠️</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STAGE 6: REVIEW (HOT PIZZA STEAM) ── */}
      {stage === 'review' && (
        <div className="dough-steam-overlay">
          <span className="dough-steam-curl curl-a">♨️</span>
          <span className="dough-steam-curl curl-b">♨️</span>
          <span className="dough-steam-curl curl-c">♨️</span>
        </div>
      )}
    </div>
  );
};
