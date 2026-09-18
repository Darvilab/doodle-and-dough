import logoImg from '../assets/logo.webp';
import textLogoImg from '../assets/main-text-logo.webp';

// Never keep people on the loader forever — reveal whatever has arrived by then.
const MAX_WAIT_MS = 15000;

const CRITICAL_IMAGES = [`${import.meta.env.BASE_URL}background.webp`, logoImg, textLogoImg];

// One face per file Google serves; the variable fonts cover every weight we use.
const CRITICAL_FONTS = ['700 16px Fraunces', 'italic 900 16px Fraunces', '600 16px Outfit'];

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

function waitForFontCss(): Promise<void> {
  const link = document.getElementById('font-css') as HTMLLinkElement | null;
  if (!link || link.dataset.loaded) return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

async function loadFonts(): Promise<void> {
  await waitForFontCss();
  if (!document.fonts) return;
  await Promise.allSettled(CRITICAL_FONTS.map((f) => document.fonts.load(f)));
}

/** Resolves once fonts and first-screen images are ready (or after MAX_WAIT_MS). */
export function waitForCriticalAssets(): Promise<void> {
  const ready = Promise.allSettled([loadFonts(), ...CRITICAL_IMAGES.map(loadImage)]).then(
    () => undefined
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS));
  return Promise.race([ready, timeout]);
}

export function hideBootLoader(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('done');
  const remove = () => boot.remove();
  boot.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, 600);
}
