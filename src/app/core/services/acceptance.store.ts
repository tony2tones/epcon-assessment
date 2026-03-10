import { Injectable, computed, signal } from '@angular/core';
import {
  AssignedLocation,
  JobOpportunity,
  AcceptanceToken,
  LocationFormValue,
  AcceptanceDecision,
  SubmitPayload,
} from '../models/location.model';

@Injectable({ providedIn: 'root' })
export class AcceptanceStore {
  // ── Raw signals ────────────────────────────────────────────────────────────
  readonly locations = signal<AssignedLocation[]>([]);
  readonly selectedLocationId = signal<string | null>(null);
  readonly selectedOpportunityId = signal<string | null>(null);
  readonly countryFilter = signal<string | null>(null);
  readonly workerInfo = signal<AcceptanceToken | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly selectedLocation = computed(() => {
    const id = this.selectedLocationId();
    return id ? (this.locations().find(l => l.id === id) ?? null) : null;
  });

  readonly selectedOpportunity = computed((): JobOpportunity | null => {
    const oppId = this.selectedOpportunityId();
    const loc = this.selectedLocation();
    if (!oppId || !loc) return null;
    return loc.opportunities.find(o => o.id === oppId) ?? null;
  });

  readonly filteredLocations = computed(() => {
    const filter = this.countryFilter();
    return filter
      ? this.locations().filter(l => l.country === filter)
      : this.locations();
  });

  /** Aggregate status across ALL opportunities in ALL locations */
  readonly statusSummary = computed(() => {
    const all = this.locations().flatMap(l => l.opportunities);
    return {
      pending:         all.filter(o => o.status === 'PENDING').length,
      accepted:        all.filter(o => o.status === 'ACCEPTED').length,
      declined:        all.filter(o => o.status === 'DECLINED').length,
      acceptedByOther: all.filter(o => o.status === 'ACCEPTED_BY_OTHER').length,
      total:           all.length,
    };
  });

  readonly availableCountries = computed(() =>
    [...new Set(this.locations().map(l => l.country))]
  );

  readonly hasAnyDecision = computed(() =>
    this.locations().some(l =>
      l.opportunities.some(o => o.status === 'ACCEPTED' || o.status === 'DECLINED')
    )
  );

  readonly submitPayload = computed((): SubmitPayload => {
    const token = this.workerInfo()?.token ?? '';
    const decisions: AcceptanceDecision[] = this.locations().flatMap(l =>
      l.opportunities
        .filter(o => o.status === 'ACCEPTED' || o.status === 'DECLINED')
        .map(o => ({
          locationId:       l.id,
          opportunityId:    o.id,
          status:           o.status as 'ACCEPTED' | 'DECLINED',
          scheduledDate:    o.scheduledDate,
          targetPeopleCount: o.targetPeopleCount,
        }))
    );
    return { token, decisions };
  });

  // ── Mutators ───────────────────────────────────────────────────────────────
  setLocations(locs: AssignedLocation[]): void {
    this.locations.set(locs);
  }

  setWorkerInfo(info: AcceptanceToken): void {
    this.workerInfo.set(info);
  }

  setLoading(v: boolean): void {
    this.isLoading.set(v);
  }

  setSubmitting(v: boolean): void {
    this.isSubmitting.set(v);
  }

  setError(msg: string | null): void {
    this.errorMessage.set(msg);
  }

  selectLocation(id: string | null): void {
    this.selectedLocationId.set(id);
    this.selectedOpportunityId.set(null); // clear opp selection when switching area
  }

  selectOpportunity(id: string | null): void {
    this.selectedOpportunityId.set(id);
  }

  setCountryFilter(code: string | null): void {
    this.countryFilter.update(current => (current === code ? null : code));
  }

  acceptOpportunity(locationId: string, opportunityId: string, formValue: LocationFormValue): void {
    this.locations.update(locs =>
      locs.map(l =>
        l.id !== locationId
          ? l
          : {
              ...l,
              opportunities: l.opportunities.map(o =>
                o.id !== opportunityId
                  ? o
                  : {
                      ...o,
                      status: 'ACCEPTED' as const,
                      scheduledDate: formValue.scheduledDate.toISOString().split('T')[0],
                      targetPeopleCount: formValue.targetPeopleCount,
                    }
              ),
            }
      )
    );
  }

  declineOpportunity(locationId: string, opportunityId: string): void {
    this.locations.update(locs =>
      locs.map(l =>
        l.id !== locationId
          ? l
          : {
              ...l,
              opportunities: l.opportunities.map(o =>
                o.id === opportunityId && o.status !== 'ACCEPTED_BY_OTHER'
                  ? { ...o, status: 'DECLINED' as const }
                  : o
              ),
            }
      )
    );
  }

  declineAll(): void {
    this.locations.update(locs =>
      locs.map(l => ({
        ...l,
        opportunities: l.opportunities.map(o =>
          o.status === 'PENDING' ? { ...o, status: 'DECLINED' as const } : o
        ),
      }))
    );
  }
}
