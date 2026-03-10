export type LocationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'ACCEPTED_BY_OTHER';
export type ActivityType = 'TB_SCREENING' | 'VACCINATION' | 'MALARIA_PREVENTION' | 'NUTRITION_SURVEY';

/** A single role/position within an area */
export interface JobOpportunity {
  id: string;
  activityType: ActivityType;
  status: LocationStatus;
  scheduledDate: string; // 'YYYY-MM-DD'
  targetPeopleCount: number;
}

/** A geographic area that may contain one or more job opportunities */
export interface AssignedLocation {
  id: string;
  name: string;
  country: string;       // ISO 3166-1 alpha-2
  countryName: string;
  coordinates: { lat: number; lng: number };
  description?: string;
  opportunities: JobOpportunity[];
}

export interface LocationFormValue {
  scheduledDate: Date;
  targetPeopleCount: number;
}

export interface AcceptanceDecision {
  locationId: string;
  opportunityId: string;
  status: 'ACCEPTED' | 'DECLINED';
  scheduledDate: string;
  targetPeopleCount: number;
}

export interface SubmitPayload {
  token: string;
  decisions: AcceptanceDecision[];
}

export interface AcceptanceToken {
  token: string;
  workerName: string;
  workerEmail: string;
  locationIds: string[];
}
