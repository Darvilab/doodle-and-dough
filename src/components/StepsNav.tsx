import React from 'react';
import { Stage } from '../types/pizza';
import { SND } from '../services/audio';

interface StepsNavProps {
  currentStage: Stage;
  onSelectStage?: (stage: Stage) => void;
}

const STEPS: { stage: Stage; label: string; icon: string }[] = [
  { stage: 'base', label: 'Crust', icon: '🌾' },
  { stage: 'sauce', label: 'Sauce', icon: '🍅' },
  { stage: 'cheese', label: 'Cheese', icon: '🧀' },
  { stage: 'top', label: 'Tops', icon: '🍕' },
  { stage: 'bake', label: 'Bake', icon: '🔥' },
  { stage: 'review', label: 'Score', icon: '⭐' }
];

export const StepsNav: React.FC<StepsNavProps> = ({ currentStage, onSelectStage }) => {
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.stage === currentStage)
  );
  const progressPct = (currentIndex / (STEPS.length - 1)) * 100;

  const handleClick = (stage: Stage) => {
    SND.tick();
    if (onSelectStage) {
      onSelectStage(stage);
    }
  };

  return (
    <nav id="stepsbar" aria-label="Pizza building quest progress">
      {/* Connecting Quest Track */}
      <div className="steps-track">
        <div className="steps-track-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {STEPS.map((step, index) => {
        const isDone = currentIndex > index;
        const isActive = currentIndex === index;

        return (
          <button
            key={step.stage}
            type="button"
            className={`step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
            onClick={() => handleClick(step.stage)}
            title={`Go to Stage ${index + 1}: ${step.label}`}
          >
            <div className="dot-wrap">
              <i className="dot">
                {isDone ? (
                  <span className="dot-check">✓</span>
                ) : isActive ? (
                  <span className="dot-active-badge">{index + 1}</span>
                ) : (
                  <span className="dot-num">{index + 1}</span>
                )}
              </i>
              {isActive && <span className="dot-pulse-ring" />}
            </div>
            <span>{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
