import { Injectable } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';
import { AssignedLocation, AcceptanceToken, SubmitPayload } from '../models/location.model';

const MOCK_LOCATIONS: AssignedLocation[] = [
  {
    id: 'area-001',
    name: 'Chipata District',
    country: 'ZM',
    countryName: 'Zambia',
    coordinates: { lat: -13.6415, lng: 32.6427 },
    description: 'High-burden TB district with active case-finding activities. Rural communities with limited healthcare access require on-site screening and vaccination outreach.',
    opportunities: [
      {
        id: 'opp-001-a',
        activityType: 'TB_SCREENING',
        status: 'PENDING',
        scheduledDate: '2026-04-10',
        targetPeopleCount: 250,
      },
      {
        id: 'opp-001-b',
        activityType: 'VACCINATION',
        status: 'PENDING',
        scheduledDate: '2026-04-15',
        targetPeopleCount: 180,
      },
    ],
  },
  {
    id: 'area-002',
    name: 'Lusaka Central',
    country: 'ZM',
    countryName: 'Zambia',
    coordinates: { lat: -15.4167, lng: 28.2833 },
    description: 'Dense urban center with multi-disease burden. Coordinated TB and nutrition interventions are needed to address underserved peri-urban communities.',
    opportunities: [
      {
        id: 'opp-002-a',
        activityType: 'TB_SCREENING',
        status: 'ACCEPTED_BY_OTHER',
        scheduledDate: '2026-04-20',
        targetPeopleCount: 500,
      },
      {
        id: 'opp-002-b',
        activityType: 'NUTRITION_SURVEY',
        status: 'PENDING',
        scheduledDate: '2026-04-22',
        targetPeopleCount: 120,
      },
    ],
  },
  {
    id: 'area-003',
    name: 'Nairobi Metro',
    country: 'KE',
    countryName: 'Kenya',
    coordinates: { lat: -1.2741, lng: 36.8022 },
    description: 'Peri-urban informal settlements with high malaria prevalence and vaccination coverage gaps. Significant risk of measles outbreaks in under-5 population.',
    opportunities: [
      {
        id: 'opp-003-a',
        activityType: 'MALARIA_PREVENTION',
        status: 'PENDING',
        scheduledDate: '2026-04-12',
        targetPeopleCount: 320,
      },
      {
        id: 'opp-003-b',
        activityType: 'VACCINATION',
        status: 'DECLINED',
        scheduledDate: '2026-04-14',
        targetPeopleCount: 200,
      },
      {
        id: 'opp-003-c',
        activityType: 'NUTRITION_SURVEY',
        status: 'PENDING',
        scheduledDate: '2026-04-18',
        targetPeopleCount: 150,
      },
    ],
  },
  {
    id: 'area-004',
    name: 'Dar es Salaam Port District',
    country: 'TZ',
    countryName: 'Tanzania',
    coordinates: { lat: -6.7924, lng: 39.2083 },
    description: 'Coastal district with elevated TB transmission among port worker communities. High population mobility increases disease spread risk across the region.',
    opportunities: [
      {
        id: 'opp-004-a',
        activityType: 'TB_SCREENING',
        status: 'PENDING',
        scheduledDate: '2026-04-25',
        targetPeopleCount: 400,
      },
      {
        id: 'opp-004-b',
        activityType: 'MALARIA_PREVENTION',
        status: 'PENDING',
        scheduledDate: '2026-04-28',
        targetPeopleCount: 275,
      },
    ],
  },
];

const MOCK_TOKEN: AcceptanceToken = {
  token: 'abc123xyz',
  workerName: 'Dr. Sarah Okonkwo',
  workerEmail: 'sarah.okonkwo@epcon.org',
  locationIds: MOCK_LOCATIONS.map(l => l.id),
};

@Injectable({ providedIn: 'root' })
export class LocationService {
  validateToken(token: string): Observable<AcceptanceToken | null> {
    if (token === MOCK_TOKEN.token) {
      return of(MOCK_TOKEN).pipe(delay(300));
    }
    return of(null).pipe(delay(300));
  }

  getLocations(token: string): Observable<AssignedLocation[]> {
    if (token === MOCK_TOKEN.token) {
      return of(MOCK_LOCATIONS.map(l => ({
        ...l,
        opportunities: [...l.opportunities],
      }))).pipe(delay(400));
    }
    return throwError(() => new Error('Invalid token'));
  }

  submitDecisions(payload: SubmitPayload): Observable<{ success: boolean }> {
    console.log('Submitting decisions:', payload);
    return of({ success: true }).pipe(delay(1200));
  }
}
