import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AcceptanceStore } from '../../../../core/services/acceptance.store';
import { LocationService } from '../../../../core/services/location.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-submit-actions',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatDividerModule],
  styles: [`
    .sidebar-footer {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      flex-shrink: 0;
      button { flex: 1; }
    }
  `],
  template: `
    <mat-divider />
    <div class="sidebar-footer">
      <button
        mat-stroked-button
        color="warn"
        [disabled]="store.statusSummary().pending === 0"
        [attr.aria-disabled]="store.statusSummary().pending === 0"
        aria-label="Decline all pending assignments"
        (click)="declineAll()"
      >
        <mat-icon aria-hidden="true">block</mat-icon>
        Decline All
      </button>

      <button
        mat-flat-button
        color="primary"
        [disabled]="!store.hasAnyDecision() || store.isSubmitting()"
        [attr.aria-disabled]="!store.hasAnyDecision() || store.isSubmitting()"
        [attr.aria-busy]="store.isSubmitting()"
        aria-label="Confirm and submit your decisions"
        (click)="openConfirmDialog()"
      >
        <mat-icon aria-hidden="true">send</mat-icon>
        {{ store.isSubmitting() ? 'Submitting…' : 'Confirm' }}
      </button>
    </div>
  `,
})
export class SubmitActionsComponent {
  readonly store = inject(AcceptanceStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly locationService = inject(LocationService);

  declineAll(): void {
    this.store.declineAll();
    this.snackBar.open('All pending assignments declined.', undefined, { duration: 4000 });
  }

  openConfirmDialog(): void {
    const summary = this.store.statusSummary();
    const data: ConfirmDialogData = {
      accepted: summary.accepted,
      declined: summary.declined,
      pending:  summary.pending,
    };

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data,
      width: '480px',
      panelClass: 'epcon-dialog',
    });

    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) this.submitDecisions();
    });
  }

  private submitDecisions(): void {
    this.store.setSubmitting(true);
    this.locationService.submitDecisions(this.store.submitPayload()).subscribe({
      next: () => {
        this.store.setSubmitting(false);
        this.snackBar.open('Decisions submitted successfully!', 'Close', { duration: 5000 });
      },
      error: () => {
        this.store.setSubmitting(false);
        this.snackBar.open('Submission failed. Please try again.', 'Retry', { duration: 8000 });
      },
    });
  }
}
