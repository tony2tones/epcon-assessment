import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AcceptanceStore } from '../../../../core/services/acceptance.store';
import { MatDivider } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivityTypePipe } from '../../../../shared/pipes/activity-type.pipe';
import { StatusClassPipe } from '../../../../shared/pipes/status-class.pipe';

@Component({
  selector: 'app-area-overview',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDivider,
    MatTooltipModule,
    ActivityTypePipe,
    StatusClassPipe,
  ],
  templateUrl: './area-overview.component.html',
  styleUrl: './area-overview.component.scss'
})
export class AreaOverviewComponent {
  readonly store = inject(AcceptanceStore);

  clearFilter(): void {
    this.store.setCountryFilter(null);
  }
}
