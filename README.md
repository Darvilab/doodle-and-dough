# Doodle & Dough — Artisanal Pizza Builder & Live Order App

A modern, high-performance **React + TypeScript + Vite** web application converted from the initial
HTML canvas prototype.

## Features

- **Interactive Canvas Physics**:
  - **Base**: Interactive rolling pin gestures to stretch dough with flour puff particles; animated
    toss with squash & stretch physics.
  - **Sauce**: Fluid ladle movement that paints marinara or pesto sauces with coverage tracking.
  - **Cheese**: Gravity-driven cheese curd sprinkling with press-and-hold interaction and extra
    cheese options.
  - **Toppings**: Tap-to-add or drag-and-drop onto the pizza canvas, supporting whole, left half,
    and right half zone splits with weight and variety limit monitoring.
  - **Wood-Fired Oven Bake**: Custom oven rendering with glowing embers, heat convection, cheese
    bubbling, blister browning, and live doneness gauge (Doughy → Golden → Pull now → Char).
  - **Review & Receipt**: Itemized receipt breakdown, live quantity steppers, server-authoritative
    POS blueprint generation.
- **Procedural Web Audio Engine**: Zero external audio assets; real-time synthesis of rolling,
  sizzling, squelching, oven rumbling, ticking, and victory fanfare via the Web Audio API.
- **Responsive Craft Editorial Design**: Authentic neo-brutalist tactile styling using the Fraunces
  and Outfit typefaces.
- **Draft Order Persistence**: Your in-progress build survives a page refresh via localStorage.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation & Development

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

### Quality Checks

```bash
npm run lint    # ESLint
npm run test    # Vitest unit tests
npm run build   # Type-check + production build
```

### Production Build

```bash
npm run build
```
