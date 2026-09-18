import React from 'react';
import { usePizza } from '../../context/PizzaContext';
import { CATALOG, fmt } from '../../constants/catalog';
import { CrustId, SizeId } from '../../types/pizza';
import { SND, vib } from '../../services/audio';

interface TrayBaseProps {
  spread: number;
}

export const TrayBase: React.FC<TrayBaseProps> = ({ spread }) => {
  const { state, setSizeId, setCrustId } = usePizza();

  const handleSelectSize = (id: SizeId) => {
    setSizeId(id);
    SND.tick();
    vib(8);
  };

  const handleSelectCrust = (id: CrustId) => {
    setCrustId(id);
    SND.tick();
    vib(8);
  };

  const spreadPct = Math.min(100, Math.round(spread * 100));
  const isReady = spread >= 1;

  return (
    <>
      <div className="stage-ribbon">
        <span className="star">★</span>
        <span>LEVEL 1: SHAPE THE CRUST</span>
        <span className="star">★</span>
      </div>

      <div className="seg game-seg" id="segSize">
        {(['8', '12', '15'] as SizeId[]).map(id => (
          <button
            key={id}
            type="button"
            className={`game-opt ${state.sizeId === id ? 'on' : ''}`}
            onClick={() => handleSelectSize(id)}
          >
            <span className="opt-title">{CATALOG.sizes[id].label}</span>
            <small>{fmt(CATALOG.sizes[id].price)}</small>
            {state.sizeId === id && <span className="opt-check">✓</span>}
          </button>
        ))}
      </div>

      <div className="seg game-seg" id="segCrust">
        {(Object.keys(CATALOG.crusts) as CrustId[]).map(id => (
          <button
            key={id}
            type="button"
            className={`game-opt ${state.crustId === id ? 'on' : ''}`}
            onClick={() => handleSelectCrust(id)}
          >
            <span className="opt-title">{CATALOG.crusts[id].label}</span>
            <small>
              {CATALOG.crusts[id].price ? '+' + fmt(CATALOG.crusts[id].price) : 'included'}
            </small>
            {state.crustId === id && <span className="opt-check">✓</span>}
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--ink2)', fontWeight: 600 }}>
        {CATALOG.crusts[state.crustId]?.desc}
      </div>

      <div style={{ textAlign: 'center', fontSize: '10.5px', color: 'var(--basil)', fontWeight: 700, margin: '2px 0 4px' }}>
        🌿 Finished with garlic-infused olive oil
      </div>
    </>
  );
};
