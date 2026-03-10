import { Component, inject, effect } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AcceptanceStore } from '../../../../core/services/acceptance.store';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ActivityTypePipe } from '../../../../shared/pipes/activity-type.pipe';
import { LocationFormValue } from '../../../../core/models/location.model';
import { getActivityIcon } from '../../../../shared/constants/activity-icons.const';

@Component({
  selector: 'app-location-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    StatusBadgeComponent,
    ActivityTypePipe,
  ],
  templateUrl: './location-detail.component.html',
  styleUrl: './location-detail.component.scss',
})
export class LocationDetailComponent {
  readonly store = inject(AcceptanceStore);
  private readonly fb = inject(FormBuilder);

  readonly today = new Date();

  readonly form = this.fb.group({
    scheduledDate:     [null as Date | null, [Validators.required]],
    targetPeopleCount: [null as number | null, [Validators.required, Validators.min(1), Validators.max(10000)]],
  });

  constructor() {
    effect(() => {
      const opp = this.store.selectedOpportunity();
      if (opp) {
        const date = opp.scheduledDate ? new Date(opp.scheduledDate + 'T00:00:00') : null;
        this.form.patchValue({ scheduledDate: date, targetPeopleCount: opp.targetPeopleCount });
        opp.status === 'ACCEPTED_BY_OTHER' ? this.form.disable() : this.form.enable();
      }
    });
  }

  readonly getActivityIcon = getActivityIcon;

  accept(): void {
    if (this.form.invalid) return;
    const loc = this.store.selectedLocation();
    const oppId = this.store.selectedOpportunityId();
    if (!loc || !oppId) return;
    this.store.acceptOpportunity(loc.id, oppId, this.form.getRawValue() as LocationFormValue);
    this.store.selectOpportunity(null);
  }

  decline(): void {
    const loc = this.store.selectedLocation();
    const oppId = this.store.selectedOpportunityId();
    if (!loc || !oppId) return;
    this.store.declineOpportunity(loc.id, oppId);
    this.store.selectOpportunity(null);
  }

  close(): void {
    this.store.selectOpportunity(null);
  }
}
