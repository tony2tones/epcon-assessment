import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { LocationStatus } from '../../../core/models/location.model';

const STATUS_LABELS: Record<LocationStatus, string> = {
  PENDING:           'Pending',
  ACCEPTED:          'Accepted',
  DECLINED:          'Declined',
  ACCEPTED_BY_OTHER: 'Taken',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [MatChipsModule],
  template: `
    <mat-chip
      [class]="'status-chip status-chip--' + status().toLowerCase().replace('_', '-')"
      role="status"
      [attr.aria-label]="'Status: ' + label"
    >
      {{ label }}
    </mat-chip>
  `,
  styles: [`
    .status-chip {
      font-size: 0.7rem;
      font-weight: 600;
      height: 22px;
      padding: 0 8px;
      border-radius: 11px;
      pointer-events: none;
    }
    .status-chip--pending          { background: #e3f2fd !important; color: #1565c0 !important; }
    .status-chip--accepted         { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-chip--declined         { background: #ffebee !important; color: #c62828 !important; }
    .status-chip--accepted-by-other{ background: #eceff1 !important; color: #455a64 !important; }
  `],
})
export class StatusBadgeComponent {
  readonly status = input.required<LocationStatus>();

  get label(): string {
    return STATUS_LABELS[this.status()];
  }
}
