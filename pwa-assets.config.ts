import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Regenerate with `npm run generate-pwa-assets` after changing src/assets/logo.png
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#f8f3e8' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#f8f3e8' } }
  },
  images: ['src/assets/logo.png']
});
