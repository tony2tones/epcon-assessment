import { Pipe, PipeTransform } from '@angular/core';
import { LocationStatus } from '../../core/models/location.model';

const STATUS_CLASSES: Record<LocationStatus, string> = {
  PENDING:           'pending',
  ACCEPTED:          'accepted',
  DECLINED:          'declined',
  ACCEPTED_BY_OTHER: 'accepted-by-other',
};

@Pipe({ name: 'statusClass', standalone: true })
export class StatusClassPipe implements PipeTransform {
  transform(status: LocationStatus): string {
    return STATUS_CLASSES[status];
  }
}
