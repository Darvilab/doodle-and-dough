import React from 'react';
import { usePizza } from '../../context/PizzaContext';
import { CATALOG, fmt } from '../../constants/catalog';
import { ToppingId, Zone } from '../../types/pizza';
import { SND, vib } from '../../services/audio';

interface TrayToppingsProps {
  onStartDragTopping?: (id: ToppingId, clientX: number, clientY: number) => void;
}

const TOPSVG: Record<ToppingId, React.ReactNode> = {
  pep: (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="#C4402F" stroke="#33241A" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#E2704F" strokeWidth="4" />
      <circle cx="15" cy="16" r="2.6" fill="#7A1E12" />
      <circle cx="25" cy="23" r="2.2" fill="#7A1E12" />
    </svg>
  ),
  prosc: (
    <svg viewBox="0 0 40 40">
      <path
        d="M7 22 Q10 10 20 12 Q31 8 33 19 Q35 28 24 29 Q12 32 7 22Z"
        fill="#E6907E"
        stroke="#33241A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 20 Q18 15 26 18 M13 24 Q20 21 28 23"
        stroke="#F7CDBF"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  mush: (
    <svg viewBox="0 0 40 40">
      <path
        d="M6 22 Q6 8 20 8 Q34 8 34 22 L26 22 L25 32 Q20 35 15 32 L14 22 Z"
        fill="#F0E4CE"
        stroke="#33241A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line x1="7" y1="22" x2="33" y2="22" stroke="#A98A62" strokeWidth="2" />
    </svg>
  ),
  jalap: (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="15" fill="#4F7A38" stroke="#33241A" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="8" fill="#DCE8C2" stroke="#33241A" strokeWidth="1.6" />
    </svg>
  ),
  olive: (
    <svg viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="#3B2C26" stroke="#33241A" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="6" fill="#6B342A" stroke="#33241A" strokeWidth="2" />
      <path
        d="M11 14 A12 12 0 0 1 16 9"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  basil: (
    <svg viewBox="0 0 40 40">
      <path
        d="M20 5 Q33 14 20 35 Q7 14 20 5 Z"
        fill="#57863F"
        stroke="#33241A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M20 9 Q21 20 20 31" stroke="#EAF2DC" strokeWidth="2" fill="none" />
    </svg>
  ),
  chick: (
    <svg viewBox="0 0 40 40">
      <path
        d="M8 22 Q12 12 24 14 Q32 15 32 24 Q30 30 20 30 Q10 30 8 22Z"
        fill="#E4BA81"
        stroke="#33241A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <line
        x1="16"
        y1="17"
        x2="21"
        y2="27"
        stroke="#7A3615"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="23"
        y1="17"
        x2="28"
        y2="26"
        stroke="#7A3615"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="14" cy="24" r="1.4" fill="#3E662D" />
      <circle cx="26" cy="20" r="1.4" fill="#3E662D" />
    </svg>
  ),
  onion: (
    <svg viewBox="0 0 40 40">
      <path
        d="M10 26 Q12 12 28 14 Q30 24 16 28 Q12 28 10 26Z"
        fill="#C47E5A"
        stroke="#33241A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 24 Q18 16 26 17"
        stroke="#FFE6C8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
};

const ZONES: [Zone, string][] = [
  ['whole', 'Whole'],
  ['left', 'Left ½'],
  ['right', 'Right ½']
];

export const TrayToppings: React.FC<TrayToppingsProps> = ({ onStartDragTopping }) => {
  const { state, setZone, unitsTotal, grams, removeOneTopping } = usePizza();

  const [filter, setFilter] = React.useState<'all' | 'veg' | 'nonveg'>('all');

  const totalGrams = grams();
  const gramPct = Math.round((totalGrams / CATALOG.maxGrams) * 100);
  const isNearLimit = totalGrams > CATALOG.maxGrams * 0.9;

  const handleSelectZone = (z: Zone) => {
    setZone(z);
    SND.tick();
  };

  const handleRemove = (e: React.MouseEvent, id: ToppingId) => {
    e.stopPropagation();
    if (removeOneTopping(id)) {
      SND.tick();
      vib(8);
    }
  };

  const handlePointerDownCard = (e: React.PointerEvent<HTMLDivElement>, id: ToppingId) => {
    if ((e.target as HTMLElement).closest('.minus')) return;
    e.preventDefault();
    if (onStartDragTopping) {
      onStartDragTopping(id, e.clientX, e.clientY);
    }
  };

  const filteredToppings = CATALOG.toppings.filter(
    (t) => filter === 'all' || t.category === filter
  );

  return (
    <>
      <div className="stage-ribbon">
        <span className="star">★</span>
        <span>LEVEL 4: PILE ON TOPPINGS</span>
        <span className="star">★</span>
      </div>

      <div className="seg small game-seg" id="segZone">
        {ZONES.map(([z, label]) => (
          <button
            key={z}
            type="button"
            className={state.zone === z ? 'on' : ''}
            onClick={() => handleSelectZone(z)}
          >
            {label}
            {state.zone === z && <span className="opt-check">✓</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setFilter('all');
            SND.tick();
          }}
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
        >
          ⭐ All
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('veg');
            SND.tick();
          }}
          className={`filter-pill filter-veg ${filter === 'veg' ? 'active' : ''}`}
        >
          🥦 Veg
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('nonveg');
            SND.tick();
          }}
          className={`filter-pill filter-nonveg ${filter === 'nonveg' ? 'active' : ''}`}
        >
          🍗 Meat
        </button>
      </div>

      <div className="meterrow" style={{ margin: '2px 0' }}>
        <span>
          {isNearLimit ? '⚠️ Load' : 'Load'}&nbsp;
          <b id="wgt" className={isNearLimit ? 'urgent-text' : ''}>
            {totalGrams}/{CATALOG.maxGrams}g
          </b>
        </span>
        <div className="meter slim">
          <i
            id="wfill"
            className={isNearLimit ? 'meter-warning-pulse' : ''}
            style={{
              width: `${Math.min(100, gramPct)}%`,
              background: isNearLimit ? 'var(--tomato)' : 'var(--basil)'
            }}
          />
        </div>
      </div>

      <div className="cards">
        {filteredToppings.map((t) => {
          const n = unitsTotal(t.id);
          const currentZone = state.zone;
          const itemsCount =
            currentZone === 'whole'
              ? t.itemsPerUnit || 1
              : Math.max(1, Math.round((t.itemsPerUnit || 1) / 2));
          const unitPrice = currentZone === 'whole' ? t.price : Math.round(t.price / 2);

          return (
            <div
              key={t.id}
              className={`card game-card ${n > 0 ? 'card-selected' : ''}`}
              data-id={t.id}
              onPointerDown={(e) => handlePointerDownCard(e, t.id)}
            >
              <div className="card-icon-wrap">{TOPSVG[t.id]}</div>
              <b>{t.label}</b>
              <span className="card-price">
                +{fmt(unitPrice)}
                {itemsCount > 1 ? ` · ${itemsCount} pcs` : ''}
              </span>
              {n > 0 && <i className="ct">{n}</i>}
              <button
                type="button"
                className="minus"
                disabled={n === 0}
                aria-label={`Remove one portion of ${t.label}`}
                onClick={(e) => handleRemove(e, t.id)}
              >
                −
              </button>
            </div>
          );
        })}
      </div>

      <div className="hint">
        Tap card to drop on pizza · Drag to place · ½ zone bills half price
      </div>
    </>
  );
};
