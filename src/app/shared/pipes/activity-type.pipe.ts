import { Pipe, PipeTransform } from '@angular/core';
import { ActivityType } from '../../core/models/location.model';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  TB_SCREENING:       'TB Screening',
  VACCINATION:        'Vaccination',
  MALARIA_PREVENTION: 'Malaria Prevention',
  NUTRITION_SURVEY:   'Nutrition Survey',
};

@Pipe({ name: 'activityType', standalone: true })
export class ActivityTypePipe implements PipeTransform {
  transform(value: ActivityType | string): string {
    return ACTIVITY_LABELS[value as ActivityType] ?? value;
  }
}
