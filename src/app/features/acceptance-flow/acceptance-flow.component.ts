import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
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
        <!-- Sidebar -->
        <mat-sidenav
          mode="side"
          opened
          position="end"
          class="location-sidenav"
          aria-label="Location assignments"
        >
          <app-location-list />
        </mat-sidenav>

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
            <app-location-detail class="detail-overlay" />
          }
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styleUrl: './acceptance-flow.component.scss',
})
export class AcceptanceFlowComponent implements OnInit {
  readonly store = inject(AcceptanceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly locationService = inject(LocationService);

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
