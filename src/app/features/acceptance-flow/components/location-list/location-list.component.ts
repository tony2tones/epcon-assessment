import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AcceptanceStore } from '../../../../core/services/acceptance.store';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ActivityTypePipe } from '../../../../shared/pipes/activity-type.pipe';
import { AssignedLocation, JobOpportunity, LocationFormValue } from '../../../../core/models/location.model';
import { AreaOverviewComponent } from '../area-overview/area-overview.component';
import { SubmitActionsComponent } from '../submit-actions/submit-actions.component';
import { getActivityIcon } from '../../../../shared/constants/activity-icons.const';

@Component({
  selector: 'app-location-list',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    StatusBadgeComponent,
    ActivityTypePipe,
    AreaOverviewComponent,
    SubmitActionsComponent,
  ],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.scss',
})
export class LocationListComponent {
  readonly store = inject(AcceptanceStore);
  readonly getActivityIcon = getActivityIcon;

  selectOpportunity(opp: JobOpportunity): void {
    if (opp.status !== 'ACCEPTED_BY_OTHER') {
      this.store.selectOpportunity(opp.id);
    }
  }

  quickAccept(e: Event, loc: AssignedLocation, opp: JobOpportunity): void {
    e.stopPropagation();
    const formValue: LocationFormValue = {
      scheduledDate:     new Date(opp.scheduledDate + 'T00:00:00'),
      targetPeopleCount: opp.targetPeopleCount,
    };
    this.store.acceptOpportunity(loc.id, opp.id, formValue);
  }

  quickDecline(e: Event, locationId: string, opportunityId: string): void {
    e.stopPropagation();
    this.store.declineOpportunity(locationId, opportunityId);
  }
}
