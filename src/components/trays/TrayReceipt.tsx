import React, { useMemo, useState } from 'react';
import { usePizza } from '../../context/PizzaContext';
import { fmt } from '../../constants/catalog';
import { ToppingId } from '../../types/pizza';
import { SND, vib } from '../../services/audio';
import { calculatePizzaScore } from '../../services/scorer';

interface TrayReceiptProps {
  onEditToppings: () => void;
  onEditStage?: (stage: import('../../types/pizza').Stage) => void;
  onSpawnChip?: (x: number, y: number, charge: number) => void;
  sauceCoverage: number;
  cheeseCoverage: number;
  doneness: number;
}

const BAR_LABELS = ['Sauce', 'Cheese', 'Bake', 'Toppings'] as const;
const BAR_COLORS = ['#e74c3c', '#f1c40f', '#e67e22', '#2ecc71'];

export const TrayReceipt: React.FC<TrayReceiptProps> = ({
  onEditToppings,
  onEditStage,
  sauceCoverage,
  cheeseCoverage,
  doneness
}) => {
  const {
    state,
    setStage,
    lines,
    subtotal,
    addOneTopping,
    removeOneTopping,
    showToast
  } = usePizza();

  const [showBreakdown, setShowBreakdown] = useState(false);

  const scoreResult = useMemo(
    () => calculatePizzaScore(state, sauceCoverage, cheeseCoverage, doneness),
    [state, sauceCoverage, cheeseCoverage, doneness]
  );

  const lineItems = lines();
  const currentSubtotal = subtotal();

  const qCol =
    state.bakeQ === 'Perfect'
      ? 'var(--basil)'
      : state.bakeQ === 'Charred' || state.bakeQ === 'Underbaked'
      ? 'var(--tomato-d)'
      : 'var(--ink2)';

  const handlePlus = (id: ToppingId) => {
    const res = addOneTopping(id);
    if (!res.ok) {
      showToast(res.reason || 'Cannot add more');
      SND.deny();
    } else {
      SND.thud();
      vib(10);
    }
  };

  const handleMinus = (id: ToppingId) => {
    if (removeOneTopping(id)) {
      SND.tick();
      vib(8);
    }
  };

  const barScores = [
    scoreResult.sauceScore,
    scoreResult.cheeseScore,
    scoreResult.bakeScore,
    scoreResult.toppingScore
  ];

  // Play victory sound on mount
  React.useEffect(() => {
    SND.stamp();
    vib([30, 80, 40]);
  }, []);

  return (
    <div className="receipt game-receipt">
      {/* ── Compact Score Sidecar ── */}
      <div className="score-sidecar">
        <div
          className="score-sidecar-bar"
          onClick={() => {
            setShowBreakdown(prev => !prev);
            SND.tick();
            vib(6);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowBreakdown(prev => !prev);
              SND.tick();
              vib(6);
            }
          }}
          aria-expanded={showBreakdown}
        >
          <div className="score-sidecar-left">
            <div className="score-sidecar-pill">
              <span className="score-sidecar-star">★</span>
              <b className="score-sidecar-num">{scoreResult.score.toFixed(1)}</b>
              <small className="score-sidecar-den">/10</small>
            </div>
            <div className="score-sidecar-meta">
              <span className="score-sidecar-title">{scoreResult.badge}</span>
              <span className="score-sidecar-sub">Chef Rating · Level 6 Masterpiece</span>
            </div>
          </div>

          <div className="score-sidecar-right">
            <button
              type="button"
              className="score-breakdown-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowBreakdown(prev => !prev);
                SND.tick();
                vib(6);
              }}
              aria-label={showBreakdown ? 'Hide score breakdown' : 'Show score breakdown'}
            >
              {showBreakdown ? 'Hide ▲' : 'Breakdown ▼'}
            </button>
          </div>
        </div>

        {showBreakdown && (
          <div className="score-sidecar-details">
            <p className="score-sidecar-feedback">“{scoreResult.feedback}”</p>
            <div className="score-bars-compact">
              {BAR_LABELS.map((label, i) => (
                <div key={label} className="score-bar-compact-item">
                  <span className="score-bar-label">{label}</span>
                  <div className="score-bar-track game-score-track">
                    <div
                      className="score-bar-fill game-bar-fill"
                      style={{
                        width: `${(barScores[i] / 2.5) * 100}%`,
                        backgroundColor: BAR_COLORS[i]
                      }}
                    />
                  </div>
                  <span className="score-bar-val">{barScores[i].toFixed(1)}</span>
                </div>
              ))}
            </div>
            <p className="score-sidecar-reassure">⭐ Freshly wood-fired and handcrafted to perfection 🍕</p>
          </div>
        )}
      </div>

      {/* ── Receipt lines ── */}
      <div className="rhead">
        <span>
          Your build{' '}
          {state.bakeQ && (
            <span className="bakeq" style={{ color: qCol }}>
              {state.bakeQ} bake
            </span>
          )}
        </span>
        <button type="button" className="linkbtn" id="editTop" onClick={onEditToppings}>
          Edit toppings
        </button>
      </div>

      {lineItems.map((l, index) => {
        const [name, price, zoneDesc, toppingId, targetStage] = l;
        const stageToJump = targetStage || (toppingId ? 'top' : undefined);
        return (
          <div key={`${name}-${index}`} className="rline">
            <div className="rl">
              <b>{name}</b>
              {zoneDesc && <i>{zoneDesc}</i>}
            </div>
            {toppingId ? (
              <div className="stp">
                <button
                  type="button"
                  data-a="minus"
                  data-id={toppingId}
                  onClick={() => handleMinus(toppingId)}
                  title="Remove one"
                >
                  −
                </button>
                <button
                  type="button"
                  data-a="plus"
                  data-id={toppingId}
                  onClick={() => handlePlus(toppingId)}
                  title="Add one"
                >
                  +
                </button>
              </div>
            ) : stageToJump ? (
              <button
                type="button"
                className="edit-badge"
                onClick={() => {
                  if (onEditStage) onEditStage(stageToJump);
                  else setStage(stageToJump);
                  SND.tick();
                }}
                title={`Edit ${name}`}
              >
                edit
              </button>
            ) : null}
            <em>{fmt(price)}</em>
          </div>
        );
      })}

      <div className="rsub">
        <span>Subtotal</span>
        <b>{fmt(currentSubtotal)}</b>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--basil)', fontWeight: 700, marginTop: '4px' }}>
        🌿 All crusts finished with garlic-infused olive oil
      </div>

      <small className="rnote">
        Taxes &amp; delivery calculated at checkout. The server reprices this blueprint
        against live POS stock. Thank you for choosing Doodle &amp; Dough! ❤️
      </small>
    </div>
  );
};
