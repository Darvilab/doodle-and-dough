import React from 'react';
import { usePizza } from '../context/PizzaContext';
import logoImg from '../assets/logo.webp';

interface HeaderProps {
  onRestart: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onRestart }) => {
  const { isMuted, toggleMute } = usePizza();

  return (
    <header>
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <img
          src={logoImg}
          alt="Doodle & Dough Mascot"
          style={{ height: '34px', width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <span
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '19px',
            letterSpacing: '-0.3px',
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1,
            userSelect: 'none'
          }}
        >
          <b style={{ color: 'var(--basil)', fontWeight: 900 }}>Doodle</b>
          <span
            style={{ color: 'var(--ink2)', margin: '0 3px', fontSize: '13px', fontWeight: 800 }}
          >
            &amp;
          </span>
          <b style={{ color: 'var(--tomato-d)', fontWeight: 900 }}>Dough</b>
        </span>
      </div>
      <div className="hdr-actions">
        <button
          className="iconbtn"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#33241A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5 6 9H3v6h3l5 4z" fill="#33241A" />
            {!isMuted ? (
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
            ) : (
              <path d="M16 9l5 6M21 9l-5 6" />
            )}
          </svg>
        </button>
        <button className="iconbtn" onClick={onRestart} aria-label="Restart build">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#33241A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v5h5" />
            <path d="M3 8a9 9 0 1 1-2 6" />
          </svg>
        </button>
      </div>
    </header>
  );
};
