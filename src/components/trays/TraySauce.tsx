import React from 'react';
import { usePizza } from '../../context/PizzaContext';
import { CATALOG, fmt, SAUCE_NEED } from '../../constants/catalog';
import { SauceId } from '../../types/pizza';
import { SND, vib } from '../../services/audio';

interface TraySauceProps {
  sauceCoverage: number;
}

export const TraySauce: React.FC<TraySauceProps> = ({ sauceCoverage }) => {
  const { state, setSauceId } = usePizza();

  const handleSelectSauce = (id: SauceId) => {
    setSauceId(id);
    SND.tick();
    vib(8);
  };

  const poolPct = Math.min(100, Math.round((sauceCoverage / SAUCE_NEED) * 100));
  const isReady = poolPct >= 100;

  return (
    <>
      <div className="stage-ribbon">
        <span className="star">★</span>
        <span>LEVEL 2: SWIRL THE SAUCE</span>
        <span className="star">★</span>
      </div>

      <div className="tray-top game-tray-top">
        <div className="tray-ic ladle-bob">
          <svg viewBox="0 0 24 24">
            <path
              d="M15 4 L20 9"
              stroke="#8A6B45"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="11" cy="14" r="6.5" fill="#B9BFC7" stroke="#33241A" strokeWidth="1.8" />
            <circle cx="11" cy="14" r="4" fill="#C7402D" />
          </svg>
        </div>
        <div className="tray-txt">
          <b>Sauce Ladle Frenzy</b>
          <small>Press &amp; swirl circular motions on the base</small>
        </div>
      </div>

      <div className="seg game-seg" id="segSauce">
        {(Object.keys(CATALOG.sauces) as SauceId[]).map(id => (
          <button
            key={id}
            type="button"
            className={`game-opt ${state.sauceId === id ? 'on' : ''}`}
            onClick={() => handleSelectSauce(id)}
          >
            <span className="seg-label">
              <i className="dotc" style={{ background: CATALOG.sauces[id].color }} />
              {id === 'bechamel' ? 'Béchamel' : id === 'classic' ? 'Tomato' : id === 'pesto' ? 'Pesto' : id === 'bbq' ? 'BBQ' : 'Spicy'}
            </span>
            <small>
              {CATALOG.sauces[id].price ? `+${fmt(CATALOG.sauces[id].price)}` : 'included'}
            </small>
            {state.sauceId === id && <span className="opt-check">✓</span>}
          </button>
        ))}
      </div>

      <div className="meterrow game-meterrow">
        <div className="meter-label-wrap">
          <span>Sauce Swirl Coverage</span>
          <b className={isReady ? 'ready-text' : ''}>
            {isReady ? 'SAUCED TO PERFECTION! ✨🍅' : `${poolPct}%`}
          </b>
        </div>
        <div className="meter game-meter">
          <i
            id="mfill"
            className={`meter-fill ${isReady ? 'meter-complete' : 'meter-striped-sauce'}`}
            style={{ width: `${poolPct}%` }}
          />
        </div>
      </div>
    </>
  );
};
