import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { LocationService } from '../services/location.service';
import { AcceptanceToken } from '../models/location.model';

export const tokenResolver: ResolveFn<AcceptanceToken | null> = (route) => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const token = route.paramMap.get('token') ?? '';

  return locationService.validateToken(token).pipe(
    map(result => {
      if (!result) {
        router.navigate(['/error']);
        return null;
      }
      return result;
    }),
    catchError(() => {
      router.navigate(['/error']);
      return of(null);
    })
  );
};
