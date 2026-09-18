import { useEffect, useState } from 'react';

// Chromium-only event; not in the DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'doodle-dough:install-dismissed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Call once at startup, before React mounts — the browser may fire the event early. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function remember(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // storage unavailable — only affects this session
  }
}

function recall(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** iOS browser that can add to the home screen: Safari always, others from iOS 16.4. */
function canAddToHomeScreenOnIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports as a Mac but has touch
  const ios =
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  // In-app browsers (Instagram, Facebook, TikTok, …) have no Add to Home Screen
  if (/FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|Snapchat|LinkedInApp|GSA\//i.test(ua))
    return false;
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  if (!otherBrowser) return true;
  const m = ua.match(/OS (\d+)_(\d+)/);
  const [major, minor] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
  return major > 16 || (major === 16 && minor >= 4);
}

export type InstallMode = 'prompt' | 'ios' | null;

/** 'prompt' = one-tap install available, 'ios' = show Add to Home Screen steps, null = hide. */
export function useInstallPrompt() {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => recall(DISMISS_KEY));

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  let mode: InstallMode = null;
  if (!installed && !dismissed && !isStandalone()) {
    if (deferredPrompt) mode = 'prompt';
    else if (canAddToHomeScreenOnIos()) mode = 'ios';
  }

  const install = async () => {
    if (!deferredPrompt) return;
    const p = deferredPrompt;
    deferredPrompt = null; // a prompt event can only be used once
    await p.prompt();
    const { outcome } = await p.userChoice;
    // Chrome only offers the prompt while the app isn't installed, so this needs no persisting
    if (outcome === 'accepted') installed = true;
    notify();
  };

  // Dismissing is permanent for this browser
  const dismiss = () => {
    remember(DISMISS_KEY);
    setDismissed(true);
  };

  return { mode, install, dismiss };
}
