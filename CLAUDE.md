# EPCON Acceptance Flow — Claude Code Project Instructions

## Project Overview
Angular 19 SPA for EPCON's healthcare worker assignment acceptance flow.
Workers receive an email link → land on `/acceptance/:token` → review/accept/decline assigned intervention locations across Africa.

## Commands
```bash
npm start          # ng serve → http://localhost:4200
npm run build      # production build
npm test           # karma unit tests
```

## Dev URL
```
http://localhost:4200/acceptance/abc123xyz   # valid mock token
http://localhost:4200/bad-token             # → redirects to /error
```

## Architecture
- **Angular 19** standalone components, `@if`/`@for` syntax (no NgModules)
- **Signals** for all state (`acceptance.store.ts`) — no NgRx, no BehaviorSubjects
- **Angular Material v19** — mat-sidenav, mat-datepicker, MatDialog, MatSnackBar
- **Leaflet** (direct, no ngx-leaflet wrapper — incompatible with Angular 19)

## Key Files
| File | Purpose |
|------|---------|
| `src/app/core/models/location.model.ts` | All TypeScript interfaces |
| `src/app/core/services/acceptance.store.ts` | Signals store (single source of truth) |
| `src/app/core/services/location.service.ts` | Mock data + submit stub |
| `src/app/core/resolvers/token.resolver.ts` | Token validation before route loads |
| `src/app/features/acceptance-flow/` | Main feature (layout, map, sidebar, detail, dialog) |
| `src/styles.scss` | Dark Material theme + CSS custom properties |
| `src/assets/geo/countries.geojson` | Natural Earth country borders (110m) |

## Conventions
- Components are standalone with explicit imports
- State mutations go through `AcceptanceStore` methods only
- Leaflet operations run outside Angular zone (`NgZone.runOutsideAngular`)
- SCSS uses CSS custom properties (`--epcon-*`) for theming
- No `any` types except for Leaflet GeoJSON properties

## Theme Tokens
```
--epcon-accepted: #4caf50
--epcon-declined: #f44336
--epcon-pending:  #2196f3
--epcon-taken:    #607d8b
--epcon-bg:       #0f1117
--epcon-surface:  #1a1d2e
--epcon-cyan:     #26c6da
--epcon-teal:     #64ffda
```
