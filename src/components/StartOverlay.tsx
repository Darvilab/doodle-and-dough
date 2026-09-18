import React, { useState, useCallback } from 'react';
import logoImg from '../assets/logo.png';
import textLogoImg from '../assets/main-text-logo.png';
import { SND, vib, getAudioContext } from '../services/audio';

interface StartOverlayProps {
  visible: boolean;
  onStart: () => void;
}

interface FloatingElement {
  id: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  driftClass: string;
  content: React.ReactNode;
}

interface MascotSpark {
  id: number;
  emoji: string;
  dx: string;
  dy: string;
}

interface ConfettiPiece {
  id: number;
  char?: string;
  color?: string;
  size: number;
  cx: string;
  cy: string;
  cr: string;
}

export const StartOverlay: React.FC<StartOverlayProps> = ({ visible, onStart }) => {
  const [mascotJumping, setMascotJumping] = useState(false);
  const [mascotSparks, setMascotSparks] = useState<MascotSpark[]>([]);
  const [poppedItems, setPoppedItems] = useState<Record<string, boolean>>({});
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  // Floating ingredients definition
  const floatingElements: FloatingElement[] = [
    {
      id: 'pep-top-left',
      top: '8%',
      left: '7%',
      driftClass: 'drift-1',
      content: (
        <svg viewBox="0 0 40 40" width="34" height="34">
          <circle cx="20" cy="20" r="16" fill="#C4402F" stroke="#33241A" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke="#E2704F" strokeWidth="3" />
          <circle cx="15" cy="16" r="2.5" fill="#7A1E12" />
          <circle cx="25" cy="23" r="2.2" fill="#7A1E12" />
        </svg>
      )
    },
    {
      id: 'mush-top-right',
      top: '12%',
      right: '8%',
      driftClass: 'drift-2',
      content: (
        <svg viewBox="0 0 40 40" width="32" height="32">
          <path
            d="M6 22 Q6 8 20 8 Q34 8 34 22 L26 22 L25 32 Q20 35 15 32 L14 22 Z"
            fill="#F0E4CE"
            stroke="#33241A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <line x1="7" y1="22" x2="33" y2="22" stroke="#A98A62" strokeWidth="2" />
        </svg>
      )
    },
    {
      id: 'basil-mid-left',
      top: '46%',
      left: '5%',
      driftClass: 'drift-3',
      content: (
        <svg viewBox="0 0 40 40" width="28" height="28">
          <path
            d="M20 5 Q33 14 20 35 Q7 14 20 5 Z"
            fill="#57863F"
            stroke="#33241A"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M20 9 Q21 20 20 31" stroke="#EAF2DC" strokeWidth="2" fill="none" />
        </svg>
      )
    },
    {
      id: 'star-mid-right',
      top: '44%',
      right: '7%',
      driftClass: 'drift-star',
      content: (
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="#E7AF40"
          stroke="#33241A"
          strokeWidth="1.8"
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      )
    },
    {
      id: 'olive-bot-left',
      bottom: '14%',
      left: '8%',
      driftClass: 'drift-4',
      content: (
        <svg viewBox="0 0 40 40" width="28" height="28">
          <circle cx="20" cy="20" r="14" fill="#3B2C26" stroke="#33241A" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="6" fill="#6B342A" stroke="#33241A" strokeWidth="2" />
          <path
            d="M11 14 A12 12 0 0 1 16 9"
            stroke="rgba(255,255,255,.65)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )
    },
    {
      id: 'sparkle-bot-right',
      bottom: '15%',
      right: '9%',
      driftClass: 'drift-5',
      content: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="#E7AF40"
          stroke="#33241A"
          strokeWidth="1"
        >
          <path d="M12 0L14 9L23 12L14 15L12 24L10 15L1 12L10 9Z" />
        </svg>
      )
    },
    {
      id: 'pep-bot-center-right',
      bottom: '6%',
      right: '20%',
      driftClass: 'drift-2',
      content: (
        <svg viewBox="0 0 40 40" width="26" height="26">
          <circle cx="20" cy="20" r="16" fill="#C4402F" stroke="#33241A" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke="#E2704F" strokeWidth="3" />
        </svg>
      )
    },
    {
      id: 'star-top-mid',
      top: '3%',
      right: '32%',
      driftClass: 'drift-star',
      content: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#E7AF40">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      )
    }
  ];

  // Mascot tap easter egg
  const handleMascotClick = useCallback(() => {
    getAudioContext();
    SND.pop();
    vib([15, 40, 15]);

    if (!mascotJumping) {
      setMascotJumping(true);
      setTimeout(() => setMascotJumping(false), 750);
    }

    // Spawn 4 playful reaction sparks
    const emojis = ['✨', '🍕', '❤️', '⭐'];
    const angles = [45, 135, 225, 315];
    const newSparks = angles.map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const dist = 48 + Math.random() * 20;
      return {
        id: Date.now() + i,
        emoji: emojis[i % emojis.length],
        dx: `${Math.cos(rad) * dist}px`,
        dy: `${Math.sin(rad) * dist}px`
      };
    });

    setMascotSparks(newSparks);
    setTimeout(() => setMascotSparks([]), 800);
  }, [mascotJumping]);

  // Floating item tap pop
  const handleItemClick = useCallback((id: string) => {
    getAudioContext();
    SND.pop();
    vib(12);

    setPoppedItems((prev) => ({ ...prev, [id]: true }));
    // Respawn after 2.8s
    setTimeout(() => {
      setPoppedItems((prev) => ({ ...prev, [id]: false }));
    }, 2800);
  }, []);

  // Start Building CTA click with arcade fanfare & celebratory confetti blast
  const handleLaunch = useCallback(() => {
    if (isLaunching) return;
    setIsLaunching(true);
    getAudioContext();
    SND.gameStart();
    vib([20, 50, 20]);

    // Generate confetti blast
    const colors = ['#C43428', '#E7AF40', '#256E42', '#DE9B43', '#FFFFFF', '#33241A'];
    const emojis = ['🍕', '⭐', '✨', '🌿'];
    const burst: ConfettiPiece[] = [];

    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 110;
      const isEmoji = i % 5 === 0;
      burst.push({
        id: i,
        char: isEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: isEmoji ? 18 : 6 + Math.random() * 6,
        cx: `${Math.cos(angle) * dist}px`,
        cy: `${Math.sin(angle) * dist - 20}px`,
        cr: `${(Math.random() - 0.5) * 720}deg`
      });
    }

    setConfetti(burst);

    // Transition to builder after short blast delay
    setTimeout(() => {
      onStart();
      setIsLaunching(false);
      setConfetti([]);
    }, 420);
  }, [isLaunching, onStart]);

  return (
    <div id="startOverlay" className={!visible ? 'hide' : ''}>
      {/* Floating Interactive Ingredients Layer */}
      <div className="start-floating-layer">
        {floatingElements.map((item) => {
          if (poppedItems[item.id]) {
            return (
              <div
                key={item.id}
                className={`floating-item popped ${item.driftClass}`}
                style={{ top: item.top, bottom: item.bottom, left: item.left, right: item.right }}
              >
                {item.content}
              </div>
            );
          }
          return (
            <div
              key={item.id}
              className={`floating-item ${item.driftClass}`}
              style={{ top: item.top, bottom: item.bottom, left: item.left, right: item.right }}
              onClick={() => handleItemClick(item.id)}
              title="Tap to pop!"
            >
              {item.content}
            </div>
          );
        })}
      </div>

      {/* Arcade Level Ribbon */}
      <div className="game-arcade-ribbon">
        <span className="ribbon-star">★</span>
        <span>ARCADE PIZZA KITCHEN · READY CHEF?</span>
        <span className="ribbon-star">★</span>
      </div>

      {/* Mascot Stage with Sunburst and Interactive Jump */}
      <div className="mascot-stage" onClick={handleMascotClick} title="Tap the chef!">
        <div className="mascot-sunburst" />
        <div className="mascot-halo-glow" />
        <img
          src={logoImg}
          alt="Doodle & Dough Mascot"
          className={`sliceart ${mascotJumping ? 'jumping' : ''}`}
        />
        {/* Mascot Reaction Sparks */}
        {mascotSparks.map((s) => (
          <span
            key={s.id}
            className="mascot-spark"
            style={
              {
                '--dx': s.dx,
                '--dy': s.dy
              } as React.CSSProperties
            }
          >
            {s.emoji}
          </span>
        ))}
      </div>

      {/* Title Logo Stage with Entrance Bounce & Celebration Sparks */}
      <div className="start-logo-stage" key={visible ? 'logo-active' : 'logo-idle'}>
        <div className="start-logo-wrap">
          <img src={textLogoImg} alt="Doodle & Dough — Pizza Your Way" className="main-text-logo" />
          <div className="logo-sheen" />
        </div>

        {/* Playful Arcade Sparks on Text Logo Entrance (Auto, Once) */}
        <div className="logo-intro-sparks" aria-hidden="true">
          <span
            className="logo-spark sp-1"
            style={{ '--dx': '-76px', '--dy': '-26px' } as React.CSSProperties}
          >
            ✨
          </span>
          <span
            className="logo-spark sp-2"
            style={{ '--dx': '76px', '--dy': '-28px' } as React.CSSProperties}
          >
            ⭐
          </span>
          <span
            className="logo-spark sp-3"
            style={{ '--dx': '-84px', '--dy': '18px' } as React.CSSProperties}
          >
            🍕
          </span>
          <span
            className="logo-spark sp-4"
            style={{ '--dx': '82px', '--dy': '20px' } as React.CSSProperties}
          >
            ✨
          </span>
        </div>
      </div>

      {/* Tagline with Animated Pulsing Heart */}
      <p className="start-tagline">
        Fresh ingredients. Bold flavors.
        <br />
        <em style={{ color: 'var(--tomato-d)', fontStyle: 'normal', fontWeight: 700 }}>
          Made with love, delivered with joy! <span className="heart-beat">❤️</span>
        </em>
      </p>

      {/* Pricing Pill */}
      <div className="pricehint">
        <span>
          <b>8” Personal</b> from Rs. 599 · <b>12” Medium</b> from Rs. 999
        </span>
        <small style={{ color: 'var(--basil)', fontWeight: 800 }}>
          🌿 All crusts finished with garlic-infused olive oil
        </small>
      </div>

      {/* Juicy Arcade Start Button */}
      <button className="start-game-btn" onClick={handleLaunch} disabled={isLaunching}>
        <span>Start Building</span>
        <span className="btn-arrow">→</span>

        {/* Confetti Burst Particles */}
        {confetti.map((c) => (
          <span
            key={c.id}
            className="start-confetti"
            style={
              {
                '--cx': c.cx,
                '--cy': c.cy,
                '--cr': c.cr,
                width: c.char ? 'auto' : `${c.size}px`,
                height: c.char ? 'auto' : `${c.size}px`,
                backgroundColor: c.char ? 'transparent' : c.color,
                borderRadius: c.char ? '0' : '50%',
                fontSize: c.char ? `${c.size}px` : 'inherit',
                left: '50%',
                top: '50%'
              } as React.CSSProperties
            }
          >
            {c.char}
          </span>
        ))}
      </button>
    </div>
  );
};
