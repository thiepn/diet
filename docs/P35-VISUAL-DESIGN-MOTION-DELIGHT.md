# P35 — Visual Design, Motion & Delight

P35 makes Diet Copilot feel intentional and responsive without changing the product's visual identity or turning nutrition outcomes into game rewards.

## Design direction

The existing green, quiet, information-first design remains authoritative.

P35 improves how the interface **moves and responds**:

- clearer depth and hover states;
- tactile press/ripple feedback;
- softer page and card entry;
- animated numeric changes;
- animated progress fill;
- chart line drawing and bar growth;
- dialog and mobile-sheet entrance motion;
- more legible loading, success and error feedback;
- subtle status-chip activity;
- restrained ambient accent treatment.

The phase does not introduce a new color system, mascot, badge economy, streak system or decorative redesign.

## Action delight

Successful app actions can receive a compact visual burst near the status surface.

This is intentionally tied to the interaction itself, such as successfully writing a food entry, rather than to calorie intake, body weight or goal movement.

The app therefore feels responsive without rewarding potentially sensitive nutrition or body outcomes.

## Data visualization motion

Progress charts now render with motion-ready SVG paths.

- line paths use normalized `pathLength="1"`;
- newly rendered trend lines draw into place;
- bar-chart columns rise with a short stagger;
- raw weight points appear with a small scale transition;
- selected-range changes naturally retrigger the visual transition because P33 replaces the chart DOM.

The animation changes presentation only. P33 calculations and chart geometry remain deterministic and unchanged.

## Value changes

Primary Today metrics and P33 summary values are observed for real DOM changes.

When a meaningful value replaces its previous value, it receives a short update transition. Initial placeholders and em dashes are not treated as achievements.

## Accessibility

P35 respects both motion controls:

- operating-system `prefers-reduced-motion: reduce`;
- Diet Copilot's existing in-app reduced-motion preference via `data-motion="reduce"`.

In either case, decorative animations and transition-heavy chart effects are disabled.

## Mobile

P35 builds on P34 rather than replacing it.

Mobile dialogs retain bottom-sheet geometry and use a short sheet-specific entrance. P34 safe areas, keyboard handling, touch targets and PWA behavior remain unchanged.

## Performance

The raw core asset ceiling remains **750,000 bytes**.

P35 adds the dedicated `v2/p35-delight.js` runtime and motion CSS while reclaiming space by whitespace-compacting existing JavaScript sources only. No runtime logic was removed to make room.

Observed P35 raw core size: **747,917 bytes**.

## Boundaries

P35 does not:

- change nutrition calculations;
- change P31 strategy decisions;
- change P32 Copilot permissions;
- add a backend;
- add background writes;
- create calorie, weight or goal achievement mechanics;
- redesign the established theme.

## Next phase

**P36 — THIEPN Account & Ecosystem Fit**
