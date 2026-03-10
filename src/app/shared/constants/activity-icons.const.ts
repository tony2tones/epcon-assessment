import { ActivityType } from '../../core/models/location.model';

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  TB_SCREENING:       'biotech',
  VACCINATION:        'vaccines',
  MALARIA_PREVENTION: 'pest_control',
  NUTRITION_SURVEY:   'monitor_weight',
};

export function getActivityIcon(type: ActivityType): string {
  return ACTIVITY_ICONS[type] ?? 'assignment';
}
