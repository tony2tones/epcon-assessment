import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AcceptanceStore } from './acceptance.store';
import { LocationService } from './location.service';
import { AssignedLocation, JobOpportunity } from '../models/location.model';

const MOCK_OPPS: JobOpportunity[] = [
  { id: 'opp-1', activityType: 'TB_SCREENING',  status: 'PENDING',           scheduledDate: '2026-04-10', targetPeopleCount: 100 },
  { id: 'opp-2', activityType: 'VACCINATION',    status: 'ACCEPTED_BY_OTHER', scheduledDate: '2026-04-15', targetPeopleCount: 200 },
];

/** Location shell — no opportunities (mirrors lazy API response) */
const mockLocationShell: AssignedLocation = {
  id: 'loc-1',
  name: 'Test Area',
  country: 'ZM',
  countryName: 'Zambia',
  coordinates: { lat: 0, lng: 0 },
};

/** Location with opportunities already set (used for mutation tests) */
const mockLocationWithOpps: AssignedLocation = {
  ...mockLocationShell,
  opportunities: MOCK_OPPS.map(o => ({ ...o })),
};

function freshLocationWithOpps(): AssignedLocation {
  return { ...mockLocationWithOpps, opportunities: MOCK_OPPS.map(o => ({ ...o })) };
}

describe('AcceptanceStore', () => {
  let store: AcceptanceStore;
  let locationServiceSpy: jasmine.SpyObj<LocationService>;

  beforeEach(() => {
    locationServiceSpy = jasmine.createSpyObj<LocationService>('LocationService', ['getOpportunities']);
    locationServiceSpy.getOpportunities.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        AcceptanceStore,
        { provide: LocationService, useValue: locationServiceSpy },
      ],
    });

    store = TestBed.inject(AcceptanceStore);
  });

  // ── Basic setters ──────────────────────────────────────────────────────────

  it('should initialise with empty locations and loading=true', () => {
    expect(store.locations()).toEqual([]);
    expect(store.isLoading()).toBeTrue();
  });

  it('should initialise with empty loadedLocationIds and loadingLocationIds', () => {
    expect(store.loadedLocationIds().size).toBe(0);
    expect(store.loadingLocationIds().size).toBe(0);
  });

  it('setLocations should populate the locations signal', () => {
    store.setLocations([mockLocationShell]);
    expect(store.locations().length).toBe(1);
    expect(store.locations()[0].id).toBe('loc-1');
    expect(store.locations()[0].opportunities).toBeUndefined();
  });

  it('setWorkerInfo should populate the workerInfo signal', () => {
    const info = { token: 'abc', workerName: 'Test Worker', workerEmail: 'test@epcon.org', locationIds: ['loc-1'] };
    store.setWorkerInfo(info);
    expect(store.workerInfo()?.workerName).toBe('Test Worker');
  });

  it('setLoading should update the isLoading signal', () => {
    store.setLoading(false);
    expect(store.isLoading()).toBeFalse();
  });

  it('setError should update the errorMessage signal', () => {
    store.setError('Something went wrong');
    expect(store.errorMessage()).toBe('Something went wrong');
  });

  // ── Selection + lazy load ──────────────────────────────────────────────────

  it('selectLocation should update selectedLocationId', () => {
    store.selectLocation('loc-1');
    expect(store.selectedLocationId()).toBe('loc-1');
  });

  it('selectLocation should clear selectedOpportunityId', () => {
    store.selectOpportunity('opp-1');
    store.selectLocation('loc-1');
    expect(store.selectedOpportunityId()).toBeNull();
  });

  it('selectLocation(null) should clear selectedLocationId without fetching', () => {
    store.selectLocation(null);
    expect(locationServiceSpy.getOpportunities).not.toHaveBeenCalled();
  });

  it('selectLocation should trigger getOpportunities for a not-yet-loaded location', () => {
    const subject = new Subject<JobOpportunity[]>();
    locationServiceSpy.getOpportunities.and.returnValue(subject.asObservable());
    store.setLocations([mockLocationShell]);

    store.selectLocation('loc-1');
    expect(store.isOpportunitiesLoading('loc-1')).toBeTrue();
    expect(locationServiceSpy.getOpportunities).toHaveBeenCalledWith('loc-1');

    subject.next(MOCK_OPPS);
    subject.complete();

    expect(store.isOpportunitiesLoaded('loc-1')).toBeTrue();
    expect(store.isOpportunitiesLoading('loc-1')).toBeFalse();
    expect(store.locations()[0].opportunities?.length).toBe(2);
  });

  it('selectLocation should NOT re-fetch if already loaded', () => {
    const subject = new Subject<JobOpportunity[]>();
    locationServiceSpy.getOpportunities.and.returnValue(subject.asObservable());
    store.setLocations([mockLocationShell]);

    store.selectLocation('loc-1');
    subject.next(MOCK_OPPS);
    subject.complete();
    expect(locationServiceSpy.getOpportunities).toHaveBeenCalledTimes(1);

    store.selectLocation(null);
    store.selectLocation('loc-1');
    expect(locationServiceSpy.getOpportunities).toHaveBeenCalledTimes(1); // no second call
  });

  it('selectLocation should clear loading flag on error', fakeAsync(() => {
    locationServiceSpy.getOpportunities.and.returnValue(throwError(() => new Error('Network error')));
    store.setLocations([mockLocationShell]);

    store.selectLocation('loc-1');
    tick(0);

    expect(store.isOpportunitiesLoading('loc-1')).toBeFalse();
    expect(store.isOpportunitiesLoaded('loc-1')).toBeFalse();
  }));

  // ── setOpportunities + markOpportunitiesLoading ────────────────────────────

  it('setOpportunities should patch opportunities into the matching location', () => {
    store.setLocations([{ ...mockLocationShell }]);
    store.setOpportunities('loc-1', MOCK_OPPS);

    expect(store.locations()[0].opportunities?.length).toBe(2);
    expect(store.isOpportunitiesLoaded('loc-1')).toBeTrue();
    expect(store.isOpportunitiesLoading('loc-1')).toBeFalse();
  });

  it('markOpportunitiesLoading should add/remove from loadingLocationIds', () => {
    store.markOpportunitiesLoading('loc-1', true);
    expect(store.isOpportunitiesLoading('loc-1')).toBeTrue();

    store.markOpportunitiesLoading('loc-1', false);
    expect(store.isOpportunitiesLoading('loc-1')).toBeFalse();
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  it('acceptOpportunity should set status to ACCEPTED and update form values', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.acceptOpportunity('loc-1', 'opp-1', { scheduledDate: new Date('2026-05-01'), targetPeopleCount: 150 });

    const opp = store.locations()[0].opportunities!.find(o => o.id === 'opp-1')!;
    expect(opp.status).toBe('ACCEPTED');
    expect(opp.targetPeopleCount).toBe(150);
    expect(opp.scheduledDate).toBe('2026-05-01');
  });

  it('declineOpportunity should set status to DECLINED for PENDING opportunities', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.declineOpportunity('loc-1', 'opp-1');

    const opp = store.locations()[0].opportunities!.find(o => o.id === 'opp-1')!;
    expect(opp.status).toBe('DECLINED');
  });

  it('declineOpportunity should not affect ACCEPTED_BY_OTHER opportunities', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.declineOpportunity('loc-1', 'opp-2');

    const opp = store.locations()[0].opportunities!.find(o => o.id === 'opp-2')!;
    expect(opp.status).toBe('ACCEPTED_BY_OTHER');
  });

  it('declineAll should only decline PENDING opportunities', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.declineAll();

    const opps = store.locations()[0].opportunities!;
    expect(opps.find(o => o.id === 'opp-1')!.status).toBe('DECLINED');
    expect(opps.find(o => o.id === 'opp-2')!.status).toBe('ACCEPTED_BY_OTHER');
  });

  it('declineAll should safely handle locations with no opportunities loaded', () => {
    store.setLocations([{ ...mockLocationShell }]); // opportunities = undefined
    expect(() => store.declineAll()).not.toThrow();
  });

  // ── Country filter ────────────────────────────────────────────────────────

  it('filteredLocations should return all locations when no filter is set', () => {
    const ke: AssignedLocation = { ...mockLocationShell, id: 'loc-2', country: 'KE', countryName: 'Kenya' };
    store.setLocations([mockLocationShell, ke]);
    expect(store.filteredLocations().length).toBe(2);
  });

  it('filteredLocations should filter by country code', () => {
    const ke: AssignedLocation = { ...mockLocationShell, id: 'loc-2', country: 'KE', countryName: 'Kenya' };
    store.setLocations([mockLocationShell, ke]);
    store.setCountryFilter('KE');
    expect(store.filteredLocations().length).toBe(1);
    expect(store.filteredLocations()[0].country).toBe('KE');
  });

  it('setCountryFilter should toggle the filter off when the same country is selected again', () => {
    store.setCountryFilter('ZM');
    store.setCountryFilter('ZM');
    expect(store.countryFilter()).toBeNull();
  });

  // ── Computed ──────────────────────────────────────────────────────────────

  it('statusSummary should correctly aggregate opportunity statuses', () => {
    store.setLocations([mockLocationWithOpps]);
    const summary = store.statusSummary();
    expect(summary.pending).toBe(1);
    expect(summary.acceptedByOther).toBe(1);
    expect(summary.accepted).toBe(0);
    expect(summary.declined).toBe(0);
    expect(summary.total).toBe(2);
  });

  it('statusSummary should return zeros when opportunities are not yet loaded', () => {
    store.setLocations([mockLocationShell]);
    const summary = store.statusSummary();
    expect(summary.total).toBe(0);
  });

  it('hasAnyDecision should be false when no decisions have been made', () => {
    store.setLocations([mockLocationWithOpps]);
    expect(store.hasAnyDecision()).toBeFalse();
  });

  it('hasAnyDecision should be true after an opportunity is accepted', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.acceptOpportunity('loc-1', 'opp-1', { scheduledDate: new Date('2026-05-01'), targetPeopleCount: 100 });
    expect(store.hasAnyDecision()).toBeTrue();
  });

  it('submitPayload should only include ACCEPTED and DECLINED decisions', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.setWorkerInfo({ token: 'abc123', workerName: 'Test', workerEmail: 'test@epcon.org', locationIds: ['loc-1'] });
    store.acceptOpportunity('loc-1', 'opp-1', { scheduledDate: new Date('2026-05-01'), targetPeopleCount: 100 });

    const payload = store.submitPayload();
    expect(payload.token).toBe('abc123');
    expect(payload.decisions.length).toBe(1);
    expect(payload.decisions[0].opportunityId).toBe('opp-1');
    expect(payload.decisions[0].status).toBe('ACCEPTED');
  });

  it('submitPayload should exclude PENDING and ACCEPTED_BY_OTHER opportunities', () => {
    store.setLocations([freshLocationWithOpps()]);
    store.setWorkerInfo({ token: 'abc123', workerName: 'Test', workerEmail: 'test@epcon.org', locationIds: ['loc-1'] });

    const payload = store.submitPayload();
    expect(payload.decisions.length).toBe(0);
  });

  it('selectedOpportunity should resolve from selectedLocationId and selectedOpportunityId', () => {
    const subject = new Subject<JobOpportunity[]>();
    locationServiceSpy.getOpportunities.and.returnValue(subject.asObservable());
    store.setLocations([mockLocationShell]);
    store.selectLocation('loc-1');
    subject.next(MOCK_OPPS);
    subject.complete();

    store.selectOpportunity('opp-1');
    expect(store.selectedOpportunity()?.id).toBe('opp-1');
    expect(store.selectedOpportunity()?.activityType).toBe('TB_SCREENING');
  });
});
