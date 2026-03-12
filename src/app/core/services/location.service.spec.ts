import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LocationService } from './location.service';
import { AcceptanceToken, AssignedLocation, JobOpportunity } from '../models/location.model';

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocationService);
  });

  // ── validateToken ─────────────────────────────────────────────────────────

  describe('validateToken', () => {
    it('should return worker token data for a valid token', fakeAsync(() => {
      let result: AcceptanceToken | null | undefined;
      service.validateToken('abc123xyz').subscribe(r => (result = r));
      tick(300);

      expect(result).toBeTruthy();
      expect(result!.token).toBe('abc123xyz');
      expect(result!.workerName).toBe('Dr. Sarah Okonkwo');
    }));

    it('should return null for an invalid token', fakeAsync(() => {
      let result: AcceptanceToken | null | undefined;
      service.validateToken('bad-token').subscribe(r => (result = r));
      tick(300);

      expect(result).toBeNull();
    }));
  });

  // ── getLocations ──────────────────────────────────────────────────────────

  describe('getLocations', () => {
    it('should return 4 location shells (no opportunities) for a valid token', fakeAsync(() => {
      let locations: AssignedLocation[] | undefined;
      service.getLocations('abc123xyz').subscribe(l => (locations = l));
      tick(400);

      expect(locations).toBeDefined();
      expect(locations!.length).toBe(4);
      locations!.forEach(loc => {
        expect((loc as AssignedLocation).opportunities).toBeUndefined();
      });
    }));

    it('should return a new location array on each call (not the same reference)', fakeAsync(() => {
      let first: AssignedLocation[] | undefined;
      let second: AssignedLocation[] | undefined;
      service.getLocations('abc123xyz').subscribe(l => (first = l));
      tick(400);
      service.getLocations('abc123xyz').subscribe(l => (second = l));
      tick(400);

      expect(first).not.toBe(second);
    }));

    it('should error for an invalid token', fakeAsync(() => {
      let error: Error | undefined;
      service.getLocations('bad-token').subscribe({ error: e => (error = e) });
      tick(0);

      expect(error).toBeDefined();
      expect(error!.message).toBe('Invalid token');
    }));
  });

  // ── getOpportunities ──────────────────────────────────────────────────────

  describe('getOpportunities', () => {
    it('should return opportunities for a known locationId', fakeAsync(() => {
      let opps: JobOpportunity[] | undefined;
      service.getOpportunities('area-001').subscribe(o => (opps = o));
      tick(300);

      expect(opps).toBeDefined();
      expect(opps!.length).toBeGreaterThan(0);
      expect(opps![0].activityType).toBe('TB_SCREENING');
    }));

    it('should return a new array on each call (not the same reference)', fakeAsync(() => {
      let first: JobOpportunity[] | undefined;
      let second: JobOpportunity[] | undefined;
      service.getOpportunities('area-001').subscribe(o => (first = o));
      tick(300);
      service.getOpportunities('area-001').subscribe(o => (second = o));
      tick(300);

      expect(first).not.toBe(second);
    }));

    it('should error for an unknown locationId', fakeAsync(() => {
      let error: Error | undefined;
      service.getOpportunities('unknown-id').subscribe({ error: e => (error = e) });
      tick(0);

      expect(error).toBeDefined();
      expect(error!.message).toContain('unknown-id');
    }));

    it('should return 2 opportunities for area-001', fakeAsync(() => {
      let opps: JobOpportunity[] | undefined;
      service.getOpportunities('area-001').subscribe(o => (opps = o));
      tick(300);

      expect(opps!.length).toBe(2);
    }));

    it('should return 3 opportunities for area-003 (Nairobi)', fakeAsync(() => {
      let opps: JobOpportunity[] | undefined;
      service.getOpportunities('area-003').subscribe(o => (opps = o));
      tick(300);

      expect(opps!.length).toBe(3);
    }));
  });

  // ── submitDecisions ───────────────────────────────────────────────────────

  describe('submitDecisions', () => {
    it('should return success: true', fakeAsync(() => {
      let result: { success: boolean } | undefined;
      service.submitDecisions({ token: 'abc123xyz', decisions: [] }).subscribe(r => (result = r));
      tick(1200);

      expect(result).toEqual({ success: true });
    }));
  });
});
