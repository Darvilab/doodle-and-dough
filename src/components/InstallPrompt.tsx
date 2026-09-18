import React from 'react';
import { useInstallPrompt } from '../services/install';

/** Small "add to home screen" banner — rendered only on the start screen. */
export const InstallPrompt: React.FC = () => {
  const { mode, install, dismiss } = useInstallPrompt();
  if (!mode) return null;

  return (
    <div className="install-banner" role="region" aria-label="Install app">
      <span className="install-ic" aria-hidden="true">
        📲
      </span>
      {mode === 'prompt' ? (
        <>
          <span className="install-txt">
            <b>Get the app</b>
            <small>Full-screen, right from your home screen</small>
          </span>
          <button className="install-btn" onClick={install}>
            Install
          </button>
        </>
      ) : (
        <span className="install-txt">
          <b>Add to Home Screen</b>
          <small>
            Tap{' '}
            <svg className="install-share" viewBox="0 0 24 24" aria-label="Share">
              <path
                d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>{' '}
            then &ldquo;Add to Home Screen&rdquo;
          </small>
        </span>
      )}
      <button className="install-x" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
};
