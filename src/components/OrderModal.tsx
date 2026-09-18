import React, { useEffect, useState } from 'react';
import { SND, vib } from '../services/audio';

interface OrderModalProps {
  visible: boolean;
  blueprint: string;
  onBuildAnother: () => void;
  onClose?: () => void;
}

interface ModalConfetti {
  id: number;
  char?: string;
  color?: string;
  size: number;
  cx: string;
  cy: string;
  cr: string;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  visible,
  blueprint,
  onBuildAnother,
  onClose
}) => {
  const [confetti, setConfetti] = useState<ModalConfetti[]>([]);

  useEffect(() => {
    if (visible) {
      SND.win();
      vib([20, 60, 20, 60, 40]);

      // Generate victory confetti burst
      const colors = ['#C43428', '#E7AF40', '#256E42', '#DE9B43', '#FFFFFF', '#33241A'];
      const emojis = ['🍕', '⭐', '✨', '🎉', '🌿'];
      const burst: ModalConfetti[] = [];

      for (let i = 0; i < 32; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 140;
        const isEmoji = i % 4 === 0;
        burst.push({
          id: i,
          char: isEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: isEmoji ? 20 : 6 + Math.random() * 6,
          cx: `${Math.cos(angle) * dist}px`,
          cy: `${Math.sin(angle) * dist - 30}px`,
          cr: `${(Math.random() - 0.5) * 720}deg`
        });
      }
      setConfetti(burst);
    } else {
      setConfetti([]);
    }
  }, [visible]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  return (
    <div
      id="orderModal"
      className={`modal ${!visible ? 'hidden' : ''}`}
      aria-hidden={!visible}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div className="sheet game-order-sheet">
        {onClose && (
          <button
            type="button"
            className="iconbtn"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              zIndex: 10
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#33241A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '15px', height: '15px' }}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {/* Confetti Explosion */}
        {confetti.map(c => (
          <span
            key={c.id}
            className="start-confetti"
            style={{
              '--cx': c.cx,
              '--cy': c.cy,
              '--cr': c.cr,
              width: c.char ? 'auto' : `${c.size}px`,
              height: c.char ? 'auto' : `${c.size}px`,
              backgroundColor: c.char ? 'transparent' : c.color,
              borderRadius: c.char ? '0' : '50%',
              fontSize: c.char ? `${c.size}px` : 'inherit',
              left: '50%',
              top: '25%'
            } as React.CSSProperties}
          >
            {c.char}
          </span>
        ))}

        <div className="okic game-okic">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFF7EA"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5 10 18 20 6" />
          </svg>
        </div>
        <h3 className="order-title">Order Sent to Doodle &amp; Dough Kitchen! 🍕🎉</h3>
        <p>
          Thank you for crafting with us! Your pizza has been queued for authentic wood-fired baking.
        </p>
        <div style={{ fontSize: '11px', color: 'var(--ink2)', fontWeight: 600 }}>
          📞 98XXXXXXXX · 📷 @doodle.and.dough · 🛵 Pathao Food · Foodmandu · Bhoj
        </div>
        <pre id="bpPre">{blueprint}</pre>
        <button className="btn game-cta-btn ready-pulse" id="newPizzaBtn" onClick={onBuildAnother}>
          Build Another Pizza 🍕→
        </button>
      </div>
    </div>
  );
};
