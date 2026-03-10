import { Routes } from '@angular/router';
import { tokenResolver } from './core/resolvers/token.resolver';

export const routes: Routes = [
  {
    path: 'acceptance/:token',
    loadComponent: () =>
      import('./features/acceptance-flow/acceptance-flow.component').then(
        m => m.AcceptanceFlowComponent
      ),
    resolve: { tokenData: tokenResolver },
  },
  {
    path: 'error',
    loadComponent: () =>
      import('./features/error-page/error-page.component').then(
        m => m.ErrorPageComponent
      ),
  },
  { path: '', redirectTo: '/error', pathMatch: 'full' },
  { path: '**', redirectTo: '/error' },
];
