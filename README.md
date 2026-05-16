# FireSync

Autonomous wildfire coordination — public globe + command center prototype.

## Stack

- **Vite** + **React 18** (JS / JSX, no TypeScript)
- **d3-geo** for the orthographic dotted globe
- Pure CSS variables for the design system (see `src/styles.css`)

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Structure

```
src/
├── main.jsx              ← React entry
├── App.jsx               ← loading splash + view router
├── styles.css            ← design tokens + base styles
├── data.js               ← mock fires + agent log + reasoning + simulation helpers
├── ui.jsx                ← atoms + molecules (StatusDot, Mono, MetricRow…)
├── Globe.jsx             ← dotted/halftone wireframe Earth (d3 + 2D canvas)
├── PublicGlobe.jsx       ← /  – public surface
├── IncidentDrawer.jsx    ← right-side civilian fire card
├── FireSimInset.jsx      ← left-side day-by-day spread simulation
├── CommandCenter.jsx     ← /command – ops console (top rail + 3-pane)
└── CommandMap.jsx        ← stylized 2D operational map
```

## Notes

- The globe fetches Natural Earth 110m land geojson from a CDN on first load; needs internet on first paint
- The 7-day spread is synthetic — see `getProgression()` / `getBurnPolygon()` in `data.js`
- All copy + numbers are mocked
