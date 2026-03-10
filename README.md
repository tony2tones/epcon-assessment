# EPCON Healthcare Worker Acceptance Flow

> Angular 19 SPA — Assessment Implementation

---

## What It Does

Healthcare workers receive an email link (`/acceptance/:token`). They land on a full-screen map interface to review, accept, or decline their assigned intervention locations (TB screening, vaccination campaigns, etc.) across Africa.

---

## Getting Started

```bash
npm install
npm start
# Navigate to http://localhost:4200/acceptance/abc123xyz
```

---

## Implementation Breakdown

### Phase 1 — Scaffold

**Goal:** Create the project skeleton with all dependencies and global setup.

- `ng new` with `--standalone` (no NgModules), SCSS, and routing
- Installed **Angular Material v19**, **Leaflet** (note: `@asymmetrik/ngx-leaflet` does not support Angular 19 — Leaflet used directly)
- Installed `@angular/animations` for Material animation support
- **`angular.json`** — added `src/assets` directory mapping, Leaflet CSS, and relaxed budget limits
- **`app.config.ts`** — wired `provideRouter`, `provideHttpClient`, `provideAnimationsAsync`
- **`app.routes.ts`** — lazy-loaded `AcceptanceFlowComponent` (resolved by `tokenResolver`), `ErrorPageComponent`, wildcard → `/error`
- **`styles.scss`** — dark Material theme using `mat.m2-define-dark-theme`, CSS custom properties for status colors and surface colors

---

### Phase 2 — Data Layer

**Goal:** Define the contracts and state management foundation.

#### `location.model.ts`
All shared TypeScript interfaces:
- `AssignedLocation` — the core entity (id, name, activityType, country, coordinates, status, scheduledDate, targetPeopleCount)
- `LocationStatus` — `'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ACCEPTED_BY_OTHER'`
- `ActivityType` — `'TB_SCREENING' | 'VACCINATION' | 'MALARIA_PREVENTION' | 'NUTRITION_SURVEY'`
- `AcceptanceDecision`, `SubmitPayload`, `AcceptanceToken`

#### `acceptance.store.ts` — Signals Store
Single source of truth using Angular 19 Signals:
- **Raw signals:** `locations`, `selectedLocationId`, `countryFilter`, `workerInfo`, `isLoading`, `isSubmitting`, `errorMessage`
- **Computed:** `selectedLocation`, `filteredLocations`, `statusSummary`, `availableCountries`, `hasAnyDecision`, `submitPayload`
- **Mutators:** `acceptLocation(id, formValue)`, `declineLocation(id)`, `declineAll()`, `selectLocation(id)`, `setCountryFilter(code)` (toggle behavior)

Design decision: `setCountryFilter` toggles — calling it with the same code as the current filter clears it. This enables the "click country again to deselect" map UX.

#### `location.service.ts`
Mock data provider + submit stub:
- 6 locations across Zambia (3), Kenya (2), Tanzania (1) with mixed statuses
- `validateToken(token)` — returns mock worker info for `'abc123xyz'`, `null` for anything else
- `getLocations(token)` — returns mock locations with simulated delay
- `submitDecisions(payload)` — logs payload, returns `{ success: true }` after 1.2s delay

#### `token.resolver.ts`
Route resolver that validates the token before the acceptance page loads. Invalid token → `router.navigate(['/error'])` and returns `null`.

---

### Phase 3 — Shell + Map

**Goal:** Build the main layout and the Leaflet map integration.

#### `acceptance-flow.component.ts`
Layout shell using `mat-sidenav-container`:
- **Toolbar** — EPCON branding + worker name from `workerInfo` signal
- **Sidenav** (right, `mode="side"`, always open, 360px) — hosts `LocationListComponent`
- **Main content** — hosts `MapViewComponent` + floating `LocationDetailComponent` overlay (shown conditionally via `@if (store.selectedLocation())`)
- `ngOnInit` — reads resolver data from route, calls `LocationService.getLocations()`, populates store

#### `map-view.component.ts`
The most complex component — Leaflet integration:

**Initialization:**
- Creates `L.Map` centered on Africa (`[-5, 25]`, zoom 4) after `ngAfterViewInit`
- All Leaflet operations run in `NgZone.runOutsideAngular()` to prevent excessive change detection
- CartoDB Dark Matter tiles
- `L.featureGroup()` for markers (not `layerGroup` — `FeatureGroup` has `bringToFront()`)

**Three `effect()` calls:**
1. `store.locations() + store.selectedLocationId()` → re-renders all `L.circleMarker`s (color by status, larger + white border when selected)
2. `store.selectedLocation()` → `map.flyTo()` with 1.2s animation
3. `store.countryFilter() + store.availableCountries()` → re-styles GeoJSON layer, then `markersLayer.bringToFront()`

**GeoJSON:**
- Loaded via `fetch('/assets/geo/countries.geojson')` (Natural Earth 110m)
- Countries with assigned locations styled in teal, active filter highlighted in cyan, others near-invisible
- Country click → `store.setCountryFilter(ISO_A2)` (runs inside NgZone)

**Markers:**
- `L.circleMarker` per location, color driven by `STATUS_COLORS` map
- Selected marker: radius 14 + white border; normal: radius 9
- Tooltip shows name, country, status
- Click → `store.selectLocation(id)` (skipped for `ACCEPTED_BY_OTHER`)

---

### Phase 4 — Sidebar

**Goal:** Build the right-side location list with quick actions.

#### `activity-type.pipe.ts`
Standalone pipe — transforms `'TB_SCREENING'` → `'TB Screening'` via a lookup map.

#### `status-badge.component.ts`
Standalone `mat-chip` with color-coded CSS classes per status. Uses `input.required<LocationStatus>()` (Angular 19 signal-based inputs).

#### `location-list-item.component.ts`
Single row:
- Displays location name, country, activity type (via pipe), status badge
- Quick accept (→ opens detail panel) and decline buttons with active state styling
- Selected state: cyan left border highlight
- `ACCEPTED_BY_OTHER` items: dimmed, non-interactive

#### `location-list.component.ts`
Full sidebar:
- Summary chips showing pending/accepted/declined counts from `statusSummary` computed
- Country filter indicator with clear button
- Scrollable list using `@for` over `store.filteredLocations()`
- **Decline All** button (disabled when no pending) → `store.declineAll()` + snackbar
- **Confirm Decisions** button (disabled until `hasAnyDecision`) → opens `ConfirmDialogComponent`
- Submit logic: calls `LocationService.submitDecisions()`, handles success/error snackbars

---

### Phase 5 — Detail Panel + Dialog

**Goal:** Reactive form for accepting locations + confirmation dialog before submission.

#### `location-detail.component.ts`
Floating overlay panel (positioned absolute over the map):
- Shows selected location name, country, activity type, status badge
- `ACCEPTED_BY_OTHER` → shows an info notice, form disabled
- **Reactive form** with `FormBuilder`:
  - `scheduledDate` — `mat-datepicker`, `min=today`, required
  - `targetPeopleCount` — number input, `min(1)`, `max(10000)`, required
- `effect()` watches `store.selectedLocation()` → `form.patchValue()` with current values, parses `'YYYY-MM-DD'` string to `Date`
- **Accept** → `store.acceptLocation(id, formValue)` + closes panel
- **Decline** → `store.declineLocation(id)` + closes panel
- **Close (×)** → `store.selectLocation(null)`

#### `confirm-dialog.component.ts`
`MatDialog` component opened before final submission:
- Summary grid: big numbers for accepted/declined/pending counts
- Warning banner if any locations are still PENDING
- Confirmation text
- Cancel → `dialogRef.close(false)`, Submit → `dialogRef.close(true)`

---

### Phase 6 — Polish

**Goal:** Error page, assets, project documentation.

#### `error-page.component.ts`
Centered card on dark background for invalid/expired token URLs. Shows a "Contact Support" mailto link.

#### Assets
- `src/assets/geo/countries.geojson` — Natural Earth 110m country borders (downloaded from GitHub)
- `src/assets/leaflet/` — Leaflet marker images copied from `node_modules/leaflet/dist/images/`

#### `styles.scss`
- Full dark Material theme via `mat.m2-define-dark-theme` (Cyan 400 primary, Teal A200 accent, Red 400 warn)
- CSS custom property system (`--epcon-*`) for consistent theming
- Leaflet control overrides for dark theme
- Material dialog/snackbar background overrides

---

## Project Structure

```
src/
└── app/
    ├── core/
    │   ├── models/location.model.ts         ← All interfaces
    │   ├── services/
    │   │   ├── location.service.ts          ← Mock data + submit stub
    │   │   └── acceptance.store.ts          ← Signals store
    │   └── resolvers/token.resolver.ts      ← Token validation
    ├── features/
    │   ├── acceptance-flow/
    │   │   ├── acceptance-flow.component.ts ← Layout shell
    │   │   └── components/
    │   │       ├── map-view/                ← Leaflet map
    │   │       ├── location-list/           ← Sidebar + actions
    │   │       │   └── location-list-item/  ← Single row
    │   │       ├── location-detail/         ← Floating form panel
    │   │       └── confirm-dialog/          ← MatDialog
    │   └── error-page/                      ← Invalid token fallback
    └── shared/
        ├── components/status-badge/         ← Colored mat-chip
        └── pipes/activity-type.pipe.ts      ← Type label formatting
```

---

## Key Technical Decisions

| Decision | Reasoning |
|----------|-----------|
| Direct Leaflet (no ngx-leaflet) | `@asymmetrik/ngx-leaflet` only supports up to Angular 17 |
| `L.FeatureGroup` for markers | `LayerGroup` lacks `bringToFront()` — `FeatureGroup` extends it |
| `NgZone.runOutsideAngular` for Leaflet | Prevents constant change detection during map interactions |
| Signal store (no NgRx) | Lightweight, native Angular 19 primitives — sufficient for this scope |
| `effect()` for map ↔ store sync | Declarative reactivity instead of manual subscriptions |
| Token validation in resolver | Prevents the page from loading with invalid data; redirects early |

---

## Verification Checklist

1. `ng serve` → `http://localhost:4200/acceptance/abc123xyz`
2. Dark map with CartoDB tiles + 6 colored markers across Africa
3. Sidebar shows 6 locations with status badges
4. Click Kenya on map → filters to 2 locations; click again → clears
5. Click a PENDING marker → detail panel with pre-populated form
6. Change date + count → Accept → marker turns green
7. Decline a location → marker turns red
8. "Decline All" → all pending turn red + snackbar
9. "Confirm Decisions" → dialog with summary → Submit → success snackbar
10. `http://localhost:4200/bad-token` → `/error` page
