import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { AcceptanceStore } from '../../core/services/acceptance.store';
import { LocationService } from '../../core/services/location.service';
import { AcceptanceToken } from '../../core/models/location.model';
import { MapViewComponent } from './components/map-view/map-view.component';
import { LocationListComponent } from './components/location-list/location-list.component';
import { LocationDetailComponent } from './components/location-detail/location-detail.component';

@Component({
  selector: 'app-acceptance-flow',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MapViewComponent,
    LocationListComponent,
    LocationDetailComponent,
  ],
  template: `
    <div class="acceptance-shell">
      <!-- Top toolbar -->
      <mat-toolbar class="epcon-toolbar">
        <span class="logo">EPCON</span>
        <span class="toolbar-divider" aria-hidden="true"></span>
        <span class="toolbar-subtitle">Assignment Acceptance Portal</span>
        @if (store.workerInfo(); as worker) {
          <div class="worker-pill" [attr.aria-label]="'Logged in as ' + worker.workerName">
            <span class="worker-avatar" aria-hidden="true">{{ worker.workerName.charAt(0) }}</span>
            <span class="worker-name">{{ worker.workerName }}</span>
          </div>
        }
      </mat-toolbar>

      <!-- Main content: map + sidenav -->
      <mat-sidenav-container class="main-container">
        <!-- Desktop sidebar (hidden on mobile) -->
        @if (!isMobile()) {
          <mat-sidenav
            mode="side"
            opened
            position="end"
            class="location-sidenav"
            aria-label="Location assignments"
          >
            <app-location-list />
          </mat-sidenav>
        }

        <!-- Map canvas -->
        <mat-sidenav-content class="map-content" role="main" aria-label="Locations map">
          <app-map-view />
          <!-- aria-live region announces when the detail panel appears -->
          <div aria-live="polite" aria-atomic="true" class="sr-only">
            @if (store.selectedOpportunity(); as opp) {
              Position details opened: {{ opp.activityType }} at {{ store.selectedLocation()?.name }}
            }
          </div>
          @if (store.selectedOpportunity()) {
            <app-location-detail
              class="detail-overlay"
              [class.detail-overlay--mobile]="isMobile()"
            />
          }
        </mat-sidenav-content>
      </mat-sidenav-container>

      <!-- Mobile bottom drawer -->
      @if (isMobile()) {
        @if (drawerOpen()) {
          <div class="drawer-backdrop" (click)="closeDrawer()" aria-hidden="true"></div>
        }

        <div
          class="mobile-drawer"
          [class.mobile-drawer--open]="drawerOpen()"
          role="complementary"
          aria-label="Location assignments"
        >
          <!-- Handle + peek strip (always visible) -->
          <div
            class="drawer-handle-area"
            role="button"
            tabindex="0"
            [attr.aria-expanded]="drawerOpen()"
            aria-label="Toggle location assignments drawer"
            (click)="toggleDrawer()"
            (keydown.enter)="toggleDrawer()"
            (keydown.space)="$event.preventDefault(); toggleDrawer()"
          >
            <div class="drawer-handle"></div>
            <div class="drawer-peek-row">
              <div class="peek-info">
                <span class="peek-title">Assigned Locations</span>
                <div class="peek-chips">
                  @if (store.statusSummary().pending > 0) {
                    <span class="peek-chip peek-chip--pending">
                      {{ store.statusSummary().pending }} pending
                    </span>
                  }
                  @if (store.statusSummary().accepted > 0) {
                    <span class="peek-chip peek-chip--accepted">
                      {{ store.statusSummary().accepted }} accepted
                    </span>
                  }
                  @if (store.statusSummary().declined > 0) {
                    <span class="peek-chip peek-chip--declined">
                      {{ store.statusSummary().declined }} declined
                    </span>
                  }
                </div>
              </div>
              <div class="peek-right">
                <span class="peek-count-badge">{{ store.filteredLocations().length }}</span>
                <mat-icon
                  class="drawer-chevron"
                  [class.drawer-chevron--open]="drawerOpen()"
                  aria-hidden="true"
                >keyboard_arrow_up</mat-icon>
              </div>
            </div>
          </div>

          <!-- Scrollable list content -->
          <div class="drawer-content">
            <app-location-list />
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './acceptance-flow.component.scss',
})
export class AcceptanceFlowComponent implements OnInit {
  readonly store = inject(AcceptanceStore);
  readonly isMobile = signal(false);
  readonly drawerOpen = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly locationService = inject(LocationService);
  private readonly bp = inject(BreakpointObserver);

  constructor() {
    this.bp.observe('(max-width: 768px)')
      .pipe(takeUntilDestroyed())
      .subscribe(result => {
        this.isMobile.set(result.matches);
        if (!result.matches) this.drawerOpen.set(false);
      });

    // Close drawer when a detail panel opens so the overlay is visible
    effect(() => {
      if (this.store.selectedOpportunity() && this.isMobile()) {
        this.drawerOpen.set(false);
      }
    });
  }

  toggleDrawer(): void {
    this.drawerOpen.update(v => !v);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  ngOnInit(): void {
    const tokenData = this.route.snapshot.data['tokenData'] as AcceptanceToken | null;
    if (tokenData) {
      this.store.setWorkerInfo(tokenData);
      this.locationService.getLocations(tokenData.token).subscribe({
        next: locs => {
          this.store.setLocations(locs);
          this.store.setLoading(false);
          locs.forEach(loc => {
            this.store.markOpportunitiesLoading(loc.id, true);
            this.locationService.getOpportunities(loc.id).subscribe({
              next: opps => this.store.setOpportunities(loc.id, opps),
              error: () => this.store.markOpportunitiesLoading(loc.id, false),
            });
          });
        },
        error: () => {
          this.store.setError('Failed to load locations.');
          this.store.setLoading(false);
        },
      });
    }
  }
}
