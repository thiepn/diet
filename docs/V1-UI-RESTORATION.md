# V1 UI Restoration on the V2 Runtime

The post-P38 visual correction restores the **Diet Copilot V1 design language** while preserving the V2 product/runtime underneath.

## What “V1 UI” means

The production interface now uses the visual system that made the original dashboard distinct:

- neutral `#F7F8FA` canvas;
- white fixed desktop sidebar;
- coral `#FF6B55` primary accent;
- coral calorie treatment;
- blue protein treatment;
- violet weight/progress treatment;
- green completion/success treatment;
- borderless white cards with the original soft shadows;
- lighter typography and normal-case eyebrow labels;
- V1-style desktop navigation;
- V1-style white/blurred mobile bottom navigation;
- V1 modal/backdrop language;
- large calorie hero composition with supporting metrics stacked beside it on desktop.

The previous green V2 shell is not the design target.

## What stays V2

This is **not** a rollback to the legacy application runtime.

The following remain current:

- V2 food capture and food memory;
- P33 progress analytics;
- P31 strategy workflow;
- Copilot actions;
- THIEPN Account + Hub integration;
- offline/PWA behavior;
- P37 owner/write/session hardening;
- P38 release and operational certification.

The production application still uses `index.html` plus the `v2/` runtime.

## P35

The P35 motion/delight runtime remains removed.

Its documentation is retained only as historical implementation context.

## Navigation

Current V2 route names and capabilities remain because they represent the current product:

- Today
- Food
- Progress
- Strategy
- More

They are presented through the V1 visual shell rather than reverting functionality to the older four-view feature set.

## Performance

The restored UI remains inside the fixed 750 KB raw-core ceiling.

Observed raw core: **749,039 bytes**.

## Maintenance intent

Future visual work should treat V1 as the reference source. Changes should not replace it with a generic green dashboard, generic SaaS cards, or decorative motion without an explicit design decision.

## Repair note — neutral dark mode

The first V1-on-V2 rollout exposed two defects that are now part of the restoration contract:

- the 761–959 px tablet range could hide the desktop sidebar before the bottom navigation was explicitly restored;
- System dark mode could still inherit an obsolete green V2 `prefers-color-scheme` palette.

The repaired shell keeps navigation available at every supported width and uses neutral black/charcoal/gray surfaces in dark mode.

Dark-mode rule:

- canvas: near-black;
- primary surfaces/cards: charcoal/dark gray;
- secondary surfaces/buttons: a slightly lighter or darker neutral gray;
- product accent: coral;
- semantic blue/violet/green may remain only where they communicate protein, weight/progress, or success.

Green is not a general dark-mode background or chrome color.
