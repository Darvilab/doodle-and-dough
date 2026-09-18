import React from 'react';
import { usePizza } from '../../context/PizzaContext';
import { CATALOG, fmt } from '../../constants/catalog';
import { CheeseId } from '../../types/pizza';
import { SND, vib } from '../../services/audio';

interface TrayCheeseProps {
  cheeseCoverage: number;
  onBlanketCheese?: () => void;
  onClearCheese?: () => void;
}

const CHEESE_TIERS = [
  { level: 1, name: 'Standard Blanket', desc: 'Included' },
  { level: 2, name: 'Double Cheese', desc: `+${fmt(100)}` },
  { level: 3, name: 'Triple Melt', desc: `+${fmt(200)}` },
  { level: 4, name: 'Quadruple Blanket', desc: `+${fmt(300)}` },
  { level: 5, name: "Cheese Lover's Dream", desc: `+${fmt(400)}` },
  { level: 6, name: 'Deep Fondue', desc: `+${fmt(500)}` },
  { level: 7, name: 'Lava Blanket', desc: `+${fmt(600)}` },
  { level: 8, name: 'Mega Mozz', desc: `+${fmt(700)}` },
  { level: 9, name: 'Avalanche', desc: `+${fmt(800)}` },
  { level: 10, name: 'The 10x Meltdown 🧀🔥', desc: `+${fmt(900)}` }
] as const;

export const TrayCheese: React.FC<TrayCheeseProps> = ({
  cheeseCoverage,
  onBlanketCheese,
  onClearCheese
}) => {
  const {
    state,
    setCheeseId,
    setCheeseUnits,
    addCheeseUnit,
    removeCheeseUnit,
    showToast
  } = usePizza();

  const currentUnits = state.cheeseUnits || 1;
  const currentTier = CHEESE_TIERS[currentUnits - 1] || CHEESE_TIERS[0];

  const handleSelectCheese = (id: CheeseId) => {
    setCheeseId(id);
    SND.tick();
  };

  const handleMinus = () => {
    if (currentUnits > 1) {
      removeCheeseUnit();
      SND.tick();
      vib(8);
    }
  };

  const handlePlus = () => {
    if (currentUnits < 10) {
      addCheeseUnit();
      if (currentUnits + 1 === 10) {
        SND.flame();
        vib([30, 60, 30]);
        showToast('🔥 MAXIMUM 10x CHEESE MELTDOWN ACTIVATED! 🔥');
      } else if (currentUnits + 1 >= 5) {
        SND.levelUp();
        vib(15);
        showToast(`Level up! ${currentUnits + 1}x Cheese Melt 🧀`);
      } else {
        SND.thud();
        vib(15);
        showToast(`Cheese layer ${currentUnits + 1} added! Extra cheesy 🧀`);
      }
    } else {
      SND.deny();
      showToast('Maximum 10x cheese layers reached! 🧀🔥');
    }
  };

  const handleSelectPip = (lvl: number) => {
    setCheeseUnits(lvl);
    if (lvl === 10) {
      SND.flame();
      vib([30, 60, 30]);
    } else if (lvl >= 5) {
      SND.levelUp();
      vib(15);
    } else {
      SND.thud();
      vib(10);
    }
    if (lvl > currentUnits) {
      showToast(`${lvl}x Cheese layers active! (+${fmt((lvl - 1) * CATALOG.extraCheesePrice)})`);
    }
  };

  const cheeseNeed = 0.58;
  const blanketPct = Math.min(100, Math.round((cheeseCoverage / cheeseNeed) * 100));
  const isReady = blanketPct >= 100;

  return (
    <>
      <div className="stage-ribbon">
        <span className="star">★</span>
        <span>LEVEL 3: CHEESE BLANKET</span>
        <span className="star">★</span>
      </div>

      <div className="tray-top game-tray-top">
        <div className="tray-ic cheese-bob">
          <svg viewBox="0 0 24 24">
            <path
              d="M3 16 Q5 8 12 9 Q14 5 18 8 Q22 9 21 14 Q22 17 18 17 L6 17 Q3 17 3 16Z"
              fill="#F3CB77"
              stroke="#33241A"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="13" r="1.3" fill="#D9A441" />
            <circle cx="15" cy="12" r="1.1" fill="#D9A441" />
          </svg>
        </div>
        <div className="tray-txt">
          <b>Artisanal Cheese Blanket</b>
          <small>Tap &amp; drag anywhere across the base to sprinkle</small>
        </div>
      </div>

      <div className="seg game-seg" id="segCheese">
        {(Object.keys(CATALOG.cheeses) as CheeseId[]).map(id => {
          const ch = CATALOG.cheeses[id];
          return (
            <button
              key={id}
              type="button"
              className={`game-opt ${state.cheeseId === id ? 'on' : ''}`}
              onClick={() => handleSelectCheese(id)}
            >
              <span className="seg-label">
                <i className="dotc" style={{ background: ch.colors[0] }} />
                {id === 'blend' ? 'Blend' : id === 'mozzarella' ? 'Mozzarella' : id === 'yak' ? 'Yak' : 'Kanchan'}
              </span>
              <small>
                {ch.price ? `+${fmt(ch.price)}` : 'included'}
              </small>
              {state.cheeseId === id && <span className="opt-check">✓</span>}
            </button>
          );
        })}
      </div>

      {/* ── Compact Multi-Layer Cheese Controller (up to 10x limit) ── */}
      <div className={`cheese-layers-panel ${currentUnits === 10 ? 'meltdown-glow' : ''}`}>
        <div className="cheese-layers-header">
          <div className="cheese-layers-title">
            <b>Cheese Power-Up Meter</b>
            <small>
              {currentUnits === 1
                ? 'Standard layer included'
                : `+${fmt((currentUnits - 1) * CATALOG.extraCheesePrice)} (+${fmt(CATALOG.extraCheesePrice)}/layer)`}
            </small>
          </div>

          <div className="cheese-stepper">
            <button
              type="button"
              onClick={handleMinus}
              disabled={currentUnits <= 1}
              aria-label="Decrease cheese layer"
              title="Remove one layer"
            >
              −
            </button>
            <span className={`cheese-units-tag ${currentUnits === 10 ? 'max-tag' : ''}`}>
              {currentUnits}x {currentUnits === 10 ? '🔥 MAX' : 'Layers'}
            </span>
            <button
              type="button"
              onClick={handlePlus}
              disabled={currentUnits >= 10}
              aria-label="Increase cheese layer"
              title="Add another cheese layer"
            >
              +
            </button>
          </div>
        </div>

        {/* 10-pip arcade power meter */}
        <div className="cheese-pips" title="Select cheese layer (1 to 10)">
          {CHEESE_TIERS.map(t => (
            <button
              key={t.level}
              type="button"
              className={`cheese-pip ${t.level <= currentUnits ? 'active' : ''} ${t.level === 10 ? 'pip-max' : ''}`}
              onClick={() => handleSelectPip(t.level)}
              title={`${t.level}x: ${t.name} (${t.desc})`}
              aria-label={`Set ${t.level} cheese layers`}
            />
          ))}
        </div>

        <div className="cheese-tier-badge">
          <span>
            Tier: <b>{currentTier.name}</b>
          </span>
          <span style={{ color: currentUnits > 1 ? 'var(--tomato-d)' : 'var(--basil)', fontWeight: 700 }}>
            {currentTier.desc}
          </span>
        </div>
      </div>

      {/* Compact Quick Actions & Progress */}
      <div className="cheese-bottom-row">
        <div className="meterrow game-meterrow" style={{ flex: 1, margin: 0 }}>
          <div className="meter-label-wrap">
            <span>Blanket Coverage</span>
            <b className={isReady ? 'ready-text' : ''}>
              {isReady ? 'MELTY & READY! 🧀' : `${blanketPct}%`}
            </b>
          </div>
          <div className="meter game-meter">
            <i
              id="mfill"
              className={`meter-fill ${isReady ? 'meter-complete' : 'meter-striped-cheese'}`}
              style={{ width: `${blanketPct}%` }}
            />
          </div>
        </div>

        {onBlanketCheese && (
          <button
            type="button"
            className="cheese-quick-btn game-action-btn"
            onClick={onBlanketCheese}
            title="Evenly distribute cheese across the base"
          >
            ✨ Auto-Fill
          </button>
        )}
        {onClearCheese && cheeseCoverage > 0.05 && (
          <button
            type="button"
            className="cheese-quick-btn cheese-clear-btn"
            onClick={onClearCheese}
            title="Reset cheese sprinkle"
          >
            Clear
          </button>
        )}
      </div>
    </>
  );
};
