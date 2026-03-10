# EPCON Acceptance Flow — Architecture & Design Decisions

> Technical reference for the Angular 19 healthcare worker assignment portal.
> Written from the perspective of the decisions made, the trade-offs considered, and the alternatives rejected.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [State Management — Why Signals](#2-state-management--why-signals)
3. [The Signals Store in Detail](#3-the-signals-store-in-detail)
4. [Component Architecture](#4-component-architecture)
5. [Data Flow — End to End](#5-data-flow--end-to-end)
6. [Routing & Token Resolution](#6-routing--token-resolution)
7. [Leaflet Map Integration](#7-leaflet-map-integration)
8. [Alternatives Considered](#8-alternatives-considered)
9. [Why This Setup Is Efficient](#9-why-this-setup-is-efficient)
10. [Trade-offs & Known Limitations](#10-trade-offs--known-limitations)

---

## 1. High-Level Architecture

The application follows a **feature-based, layered architecture** with a clean separation between concerns:

```
┌─────────────────────────────────────────────────────────┐
│                        Routing Layer                     │
│          /acceptance/:token  →  tokenResolver            │
│          /error              →  ErrorPageComponent        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   Feature Shell                          │
│              AcceptanceFlowComponent                     │
│         (mat-sidenav-container layout host)              │
└────────┬───────────────────────────┬────────────────────┘
         │                           │
┌────────▼──────────┐    ┌───────────▼───────────────────┐
│    Map View        │    │         Sidebar               │
│  (Leaflet + GJS)   │    │  Overview → Opportunity List  │
└────────────────────┘    └───────────┬───────────────────┘
                                      │
                          ┌───────────▼───────────────────┐
                          │       Detail Panel             │
                          │  Reactive Form (Accept/Decline)│
                          └───────────────────────────────┘
                                      │
         ┌────────────────────────────▼────────────────────┐
         │                 Core Layer                       │
         │   AcceptanceStore  │  LocationService  │ Resolver │
         └──────────────────────────────────────────────────┘
```

**Key principles applied:**

- **Single source of truth** — `AcceptanceStore` owns all application state. No component holds local state that affects other components.
- **Unidirectional data flow** — data flows down from the store to components via signals; events flow up via store method calls.
- **Lazy loading** — `AcceptanceFlowComponent` and `ErrorPageComponent` are loaded on demand, not at startup.
- **Separation of concerns** — the service layer (`LocationService`) handles I/O; the store handles state; components handle rendering only.

---

## 2. State Management — Why Signals

### What are Signals?

Signals are Angular's native reactive primitive introduced in Angular 16 and stabilised in Angular 17+. A signal is a wrapper around a value that notifies consumers when it changes.

```typescript
// A writable signal
const count = signal(0);

// Read it
console.log(count()); // 0

// Write it
count.set(1);
count.update(n => n + 1);

// Derive from it (recomputes automatically)
const doubled = computed(() => count() * 2);

// React to it
effect(() => console.log('count changed:', count()));
```

The critical difference from RxJS `BehaviorSubject` is that **signals are synchronous and pull-based**. When a computed signal is read, Angular checks whether any of its dependencies changed and recomputes only if needed (memoisation). This is more predictable and more performant than push-based streams for synchronous UI state.

### Why Signals over alternatives for this project

| Concern | Signals | RxJS BehaviorSubject | NgRx |
|---------|---------|----------------------|------|
| Boilerplate | Minimal | Moderate | Heavy |
| Learning curve | Low | Medium | High |
| Bundle size impact | Zero (built-in) | Zero (built-in) | ~50KB+ |
| Change detection | Fine-grained, automatic | Zone-based / manual | Zone-based / manual |
| DevTools | Angular DevTools | RxJS DevTools | Redux DevTools |
| Async support | Via RxJS interop | Native | Native (effects) |
| Template integration | Direct (`count()`) | Requires `async` pipe | Requires selector + pipe |
| Best for | UI state, sync flows | Async streams, events | Large teams, complex async |

For this application — a single-page, single-user flow with synchronous UI state — signals are the correct primitive. The state never needs to be async (the HTTP calls are handled in the component via the service, and the results are pushed into the store synchronously). NgRx would be over-engineering. BehaviorSubjects would work but produce more verbose, less readable code.

---

## 3. The Signals Store in Detail

The store (`acceptance.store.ts`) is structured in three tiers: **raw signals → computed signals → mutator methods**.

### Tier 1 — Raw Signals (mutable)

```typescript
readonly locations          = signal<AssignedLocation[]>([]);
readonly selectedLocationId = signal<string | null>(null);
readonly selectedOpportunityId = signal<string | null>(null);
readonly countryFilter      = signal<string | null>(null);
readonly workerInfo         = signal<AcceptanceToken | null>(null);
readonly isLoading          = signal(true);
readonly isSubmitting       = signal(false);
readonly errorMessage       = signal<string | null>(null);
```

These are the only places where state can change. Marking them `readonly` prevents components from calling `.set()` directly — they must go through the store's mutator methods. This enforces the single-responsibility principle: the store decides **how** state is allowed to change.

### Tier 2 — Computed Signals (derived, read-only)

```typescript
readonly selectedLocation = computed(() => {
  const id = this.selectedLocationId();
  return id ? this.locations().find(l => l.id === id) ?? null : null;
});

readonly statusSummary = computed(() => {
  const all = this.locations().flatMap(l => l.opportunities);
  return {
    pending:  all.filter(o => o.status === 'PENDING').length,
    accepted: all.filter(o => o.status === 'ACCEPTED').length,
    declined: all.filter(o => o.status === 'DECLINED').length,
  };
});
```

**Why computed signals are powerful here:**

Computed signals are **memoised**. Angular tracks which raw signals each computed signal reads. It only re-runs the computation when one of those dependencies has actually changed. So `statusSummary` only recalculates when `locations` changes — not on every render cycle.

Consider what would happen without this: every template binding that shows a count would re-run its calculation on every change detection pass. With computed signals, the calculation runs exactly once per genuine data change, and every consumer reads the cached result.

### Tier 3 — Mutators (the only write path)

```typescript
acceptOpportunity(locationId: string, opportunityId: string, formValue: LocationFormValue): void {
  this.locations.update(locs =>
    locs.map(l =>
      l.id !== locationId ? l : {
        ...l,
        opportunities: l.opportunities.map(o =>
          o.id !== opportunityId ? o : {
            ...o,
            status: 'ACCEPTED',
            scheduledDate: formValue.scheduledDate.toISOString().split('T')[0],
            targetPeopleCount: formValue.targetPeopleCount,
          }
        ),
      }
    )
  );
}
```

Note the **immutable update pattern** — `.update()` receives the current array and returns a new one. The original array is never mutated. This matters because Angular's change detection for signals uses reference equality: if the reference hasn't changed, nothing re-renders. Immutability guarantees that signal consumers always see the correct new reference.

### The Reactivity Chain

When `acceptOpportunity()` is called, this cascade happens automatically:

```
locations.update()
  → locations signal emits new reference
    → selectedOpportunity (computed) re-evaluates  → detail panel closes
    → statusSummary (computed) re-evaluates        → sidebar chips update
    → hasAnyDecision (computed) re-evaluates       → Submit button enables
    → submitPayload (computed) re-evaluates        → payload ready for submission
    → map effect() fires                           → marker re-renders green
```

All of this happens synchronously, in one tick, with zero manual wiring.

### The `effect()` Pattern for Side Effects

`effect()` is used for **side effects** — things that need to happen in response to state changes but that aren't template rendering. The map uses three effects:

```typescript
// 1. Re-render markers when data or selection changes
effect(() => {
  const locations = this.store.locations();
  const selectedId = this.store.selectedLocationId();
  if (this.map) this.renderMarkers(locations, selectedId);
});

// 2. Fly the camera to the selected area
effect(() => {
  const selected = this.store.selectedLocation();
  if (this.map && selected) {
    this.map.flyTo([selected.coordinates.lat, selected.coordinates.lng], 7);
  }
});

// 3. Re-style country borders when filter changes
effect(() => {
  const filter = this.store.countryFilter();
  const countries = this.store.availableCountries();
  if (this.geoJsonLayer) {
    this.geoJsonLayer.setStyle(f => this.geoJsonStyle(f, countries, filter));
  }
});
```

Effects are the correct place for imperative DOM operations (Leaflet's API is entirely imperative). They cleanly separate the reactive signal layer from the imperative Leaflet layer.

---

## 4. Component Architecture

### Standalone Components

Every component in this project is **standalone** — there are no `NgModule` declarations. This is the recommended Angular 19 approach and has several advantages:

- **Explicit dependencies** — each component's `imports: []` array is its complete dependency list. There is no shared module where a dependency might be hiding.
- **Tree-shakeable** — the bundler can statically analyse exactly what each component uses.
- **Easier lazy loading** — any standalone component can be lazily loaded directly via `loadComponent()`.

### Component Responsibility Boundaries

| Component | Responsibility | What it does NOT do |
|-----------|---------------|---------------------|
| `AcceptanceFlowComponent` | Layout shell, data loading | No business logic |
| `MapViewComponent` | Leaflet rendering, map interactions | No form handling |
| `LocationListComponent` | Sidebar navigation, two-state UI | No map interaction |
| `LocationDetailComponent` | Reactive form, accept/decline | No list management |
| `ConfirmDialogComponent` | Display summary, confirm action | No submission logic |
| `StatusBadgeComponent` | Visual status display | No state interaction |

Each component reads from the store and calls store methods. They do not call each other directly. This means any component can be replaced, tested, or refactored in isolation.

### `@if` / `@for` — New Template Syntax

The project uses Angular 17+'s built-in control flow syntax rather than structural directives:

```html
<!-- New (used here) -->
@if (store.selectedLocation(); as loc) { ... }
@for (opp of loc.opportunities; track opp.id) { ... } @empty { ... }

<!-- Old (not used) -->
<ng-container *ngIf="store.selectedLocation()">...</ng-container>
<li *ngFor="let opp of opportunities; trackBy: trackById">...</li>
```

The new syntax is more readable, type-safe (the `as` binding is narrowed), and performs better — `@for` with `track` enables O(1) list diffing.

---

## 5. Data Flow — End to End

### The job-selection flow step by step

```
1. URL: /acceptance/abc123xyz
   │
   ▼
2. tokenResolver validates token via LocationService.validateToken()
   → Valid: passes AcceptanceToken to route data
   → Invalid: router.navigate(['/error'])
   │
   ▼
3. AcceptanceFlowComponent.ngOnInit()
   → reads route.snapshot.data['tokenData']
   → calls LocationService.getLocations(token)
   → on response: store.setLocations(locs) + store.setLoading(false)
   │
   ▼
4. Signals cascade:
   → locations signal emits
   → map effect() fires → renderMarkers() draws 4 area circles
   → filteredLocations computed updates → sidebar renders area list
   │
   ▼
5. User clicks a map marker
   → store.selectLocation('area-003')
   → selectedLocationId signal emits 'area-003'
   → selectedLocation computed resolves to the Nairobi Metro object
   → sidebar @if(store.selectedLocation()) switches to opportunity list
   → map effect() fires → marker grows + white border + flyTo()
   │
   ▼
6. User clicks an opportunity row ("Malaria Prevention")
   → store.selectOpportunity('opp-003-a')
   → selectedOpportunityId signal emits 'opp-003-a'
   → selectedOpportunity computed resolves to the job object
   → shell @if(store.selectedOpportunity()) renders LocationDetailComponent
   → detail panel effect() fires → form.patchValue() with existing date + count
   → aria-live region announces to screen readers
   │
   ▼
7. User changes date + count, clicks Accept
   → form.getRawValue() produces { scheduledDate: Date, targetPeopleCount: number }
   → store.acceptOpportunity('area-003', 'opp-003-a', formValue)
   → locations signal mutates immutably
   → store.selectOpportunity(null) → detail panel disappears
   → all computed signals re-evaluate (statusSummary, hasAnyDecision, submitPayload)
   → map effect fires → marker colour recalculates via aggregateColor()
   │
   ▼
8. User clicks "Confirm Decisions"
   → LocationListComponent opens ConfirmDialogComponent via MatDialog
   → Dialog shows statusSummary counts from the store
   → User clicks "Submit Decisions"
   → dialog.afterClosed() emits true
   → LocationService.submitDecisions(store.submitPayload()) is called
   → store.setSubmitting(true) → button shows "Submitting…"
   → on success: store.setSubmitting(false) + MatSnackBar success message
```

---

## 6. Routing & Token Resolution

### Why a Resolver (not a Guard)

A **guard** (`CanActivate`) answers "can you enter this route?" — yes or no. A **resolver** answers "what data do you need before rendering this route?" — it fetches data and attaches it to the route snapshot.

The `tokenResolver` does both jobs efficiently:

```typescript
export const tokenResolver: ResolveFn<AcceptanceToken | null> = (route) => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const token = route.paramMap.get('token') ?? '';

  return locationService.validateToken(token).pipe(
    map(result => {
      if (!result) {
        router.navigate(['/error']);
        return null;
      }
      return result;
    })
  );
};
```

This approach means the component never renders with a null token — the redirect happens before the component is instantiated. The component can safely assume `route.snapshot.data['tokenData']` is a valid `AcceptanceToken`.

Using a `ResolveFn` (functional resolver) rather than a class-based resolver is the Angular 19 recommended pattern — it avoids a full class definition for simple logic and is directly injectable without needing `providedIn`.

---

## 7. Leaflet Map Integration

### Why direct Leaflet (no wrapper library)

The most common Angular Leaflet wrapper, `@asymmetrik/ngx-leaflet`, only supports up to Angular 17. Rather than forking it or using `--legacy-peer-deps`, the decision was made to integrate Leaflet directly. This is actually the more transparent approach:

- No abstraction layer obscuring Leaflet's API
- No Angular-specific wrapper bugs to work around
- Full access to Leaflet's types via `@types/leaflet`

### The NgZone Pattern

Leaflet is a third-party library completely unaware of Angular's change detection. Every mouse move, tile load, and animation tick would trigger Angular's Zone.js to check for changes — potentially hundreds of times per second during map pan/zoom.

The solution is `NgZone.runOutsideAngular()`:

```typescript
ngAfterViewInit(): void {
  this.ngZone.runOutsideAngular(() => {
    this.initMap();    // map setup runs outside Angular
    this.loadGeoJson(); // GeoJSON fetch + render runs outside Angular
  });
}
```

Leaflet now runs in its own world, invisible to Angular's change detection. When a user interaction needs to update application state (clicking a marker), we explicitly re-enter Angular's zone:

```typescript
marker.on('click', () => {
  this.ngZone.run(() => this.store.selectLocation(loc.id));
  //            ↑ re-enters Angular zone so the signal update triggers CD
});
```

This is the correct, performant pattern for all imperative third-party libraries (D3, Three.js, etc.).

### Aggregate Marker Colour

Because each area now contains multiple opportunities, the marker colour must represent the aggregate state:

```typescript
function aggregateColor(loc: AssignedLocation): string {
  const pending  = opps.filter(o => o.status === 'PENDING').length;
  const accepted = opps.filter(o => o.status === 'ACCEPTED').length;
  const declined = opps.filter(o => o.status === 'DECLINED').length;

  if (pending > 0)                        return '#2196f3'; // blue  — action needed
  if (accepted > 0 && declined === 0)     return '#4caf50'; // green — all accepted
  if (declined > 0 && accepted === 0)     return '#f44336'; // red   — all declined
  return '#ff9800';                                         // amber — mixed
}
```

The priority order is intentional: **pending always wins** (blue). This keeps the most actionable information visible — a partially accepted area still shows blue so the worker knows there is still work to do.

---

## 8. Alternatives Considered

### State Management Alternatives

#### Option A: Component-local state with `@Input`/`@Output`

The simplest possible approach — each component manages its own state and passes data down through inputs.

**Why rejected:** With a map, sidebar, and detail panel all needing to react to the same selections, this would require prop-drilling 4–5 levels deep, or a complex event-emitter chain going up and back down. The moment three components need to share `selectedOpportunityId`, a shared store becomes necessary.

---

#### Option B: RxJS `BehaviorSubject` Service

The classic Angular state pattern before signals:

```typescript
@Injectable({ providedIn: 'root' })
export class AcceptanceStore {
  private _locations = new BehaviorSubject<AssignedLocation[]>([]);
  locations$ = this._locations.asObservable();

  private _selectedId = new BehaviorSubject<string | null>(null);
  selectedLocation$ = combineLatest([this._locations, this._selectedId]).pipe(
    map(([locs, id]) => locs.find(l => l.id === id) ?? null)
  );
}
```

**Why rejected:** This would work correctly but involves significantly more boilerplate:
- Every component needs `async` pipes or manual `subscribe()`/`unsubscribe()` calls
- `combineLatest`, `map`, `distinctUntilChanged` needed everywhere computed signals do the same job in one line
- Risk of memory leaks from forgotten unsubscriptions
- Less readable template code: `{{ (store.statusSummary$ | async)?.pending }}` vs `{{ store.statusSummary().pending }}`
- Signals are the Angular team's stated direction for synchronous reactive state — BehaviorSubjects remain appropriate for async streams (HTTP, WebSockets), which this store doesn't need

---

#### Option C: NgRx Store

The enterprise-grade Redux-pattern state management library for Angular.

```typescript
// actions.ts
export const acceptOpportunity = createAction(
  '[Location] Accept Opportunity',
  props<{ locationId: string; opportunityId: string; formValue: LocationFormValue }>()
);

// reducer.ts
on(acceptOpportunity, (state, { locationId, opportunityId, formValue }) => ({
  ...state,
  locations: state.locations.map(l => ...)
}))

// selectors.ts
export const selectStatusSummary = createSelector(
  selectLocations,
  (locations) => ({ pending: ..., accepted: ..., declined: ... })
);

// component.ts
this.store.dispatch(acceptOpportunity({ locationId, opportunityId, formValue }));
statusSummary$ = this.store.select(selectStatusSummary);
```

**Why rejected:**
- Approximately 4–5x the code for the same outcome
- Adds ~50KB to the bundle (significant for a single-flow SPA)
- The Redux pattern's benefits (time-travel debugging, action logging, strict immutability enforcement) are valuable at scale but unnecessary for a single self-contained flow
- NgRx is the right tool when you have many developers working on the same state, complex async side effects (NgRx Effects), or need strict audit trails — none of which apply here

**The rule of thumb:** Use NgRx when your application's state complexity exceeds what a single developer can hold in their head. Use signals when it doesn't.

---

#### Option D: Akita / NGXS / Elf

Other Angular state management libraries.

**Why rejected:** All carry dependency overhead and add a framework-within-a-framework. Signals achieve the same goals with zero additional dependencies and are the Angular team's long-term direction. Third-party state libraries are now largely solving a problem Angular solved natively.

---

### Map Alternatives

#### Option: Google Maps Angular SDK (`@angular/google-maps`)

**Why rejected:** Requires an API key with billing, making it unsuitable for a technical assessment that should be self-contained and free to run. Also adds latency from Google's CDN.

#### Option: MapLibre GL / Mapbox GL

Vector tile maps with much better visual quality.

**Why rejected:** Heavier bundle (~250KB vs Leaflet's ~40KB), more complex setup, and the project specification called for Leaflet with CartoDB Dark tiles specifically.

---

### Routing Alternatives

#### Option: Guard instead of Resolver

A `CanActivateFn` guard could redirect on invalid tokens.

**Why rejected:** Guards decide access — they don't return data. Using a resolver means the validated `AcceptanceToken` arrives pre-attached to the route, eliminating a second API call in the component. The resolver serves as both gatekeeper and data fetcher.

---

## 9. Why This Setup Is Efficient

### Change Detection

Angular 19 with signals uses **fine-grained reactivity** rather than zone-based dirty checking. Traditional Angular re-runs change detection for the entire component tree on every event. With signals:

- Only components that actually read a changed signal are re-checked
- Computed signals only recompute when their tracked dependencies change
- The map runs completely outside Angular's zone — zero change detection cost for pan/zoom/tile events

### Bundle Size

| Dependency | Approach Used | Size | Alternative | Size |
|------------|---------------|------|-------------|------|
| State management | Angular Signals (built-in) | 0KB added | NgRx | ~50KB |
| Map | Leaflet | ~40KB | Mapbox GL | ~250KB |
| Map wrapper | None (direct) | 0KB | ngx-leaflet | ~5KB + compat issues |
| UI components | Angular Material | tree-shaken | Custom components | variable |

### Memory Management

- `effect()` calls registered in a component's constructor are automatically cleaned up when the component is destroyed — no manual unsubscription
- Leaflet's `map.remove()` is called in `ngOnDestroy()` — clears all internal event listeners and DOM references
- The store is `providedIn: 'root'` — a single instance for the application lifetime, never recreated

### Code Maintainability

The signal store pattern makes the state's shape and all allowed transitions immediately visible in one file. A new developer on the team can read `acceptance.store.ts` and understand the complete state model in under 5 minutes — something that is genuinely not true of a mature NgRx implementation.

---

## 10. Trade-offs & Known Limitations

### Signals are synchronous

Signals don't natively handle async operations. The HTTP calls (`LocationService.getLocations()`) are made in the component and the results pushed into the store synchronously. For more complex async requirements (polling, WebSocket updates, optimistic updates with rollback), RxJS integration would be needed via `toSignal()` and `toObservable()`.

### Leaflet is not keyboard accessible

Leaflet markers have no native keyboard navigation. The mitigation in this implementation is:
- The sidebar provides a fully keyboard-navigable list of all the same areas and opportunities
- An `aria-live` region announces detail panel changes to screen readers
- The map is effectively a visual enhancement; all functionality is reachable without it

For a production application requiring full WCAG 2.1 AA compliance, the map interaction would need a custom keyboard navigation layer (focus management, custom Leaflet controls), which is a non-trivial amount of work.

### Mock data only

`LocationService` returns hardcoded data. In production this would be replaced with HTTP calls to a real API. The store's interface does not need to change — only the service implementation would change, because the store only cares about the shape of the data, not where it came from.

### No offline support

There is no service worker or caching strategy. For healthcare workers in areas with unreliable connectivity, a PWA approach with background sync would be a meaningful enhancement.

---

## Summary

The architecture choices in this project reflect a consistent philosophy: **use the simplest tool that correctly solves the problem, and resist complexity that isn't earned by requirements**.

- Signals over NgRx — because the state is synchronous, single-user, and single-flow
- Standalone components — because they are explicit, tree-shakeable, and the Angular 19 standard
- Direct Leaflet over a wrapper — because the wrapper was incompatible and the abstraction wasn't buying anything
- Functional resolver over class-based — because it's simpler code for simple logic
- Immutable store updates — because reference equality is how Angular's signal diffing works

Each of these decisions could be reversed given different requirements (a multi-user real-time system would justify NgRx; a larger map-heavy application would justify MapLibre). The decisions are not dogma — they are responses to the specific constraints and scope of this project.
