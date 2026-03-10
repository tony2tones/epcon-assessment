import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="error-container">
      <div class="error-card epcon-card">
        <div class="error-icon-wrap" aria-hidden="true">
          <mat-icon class="error-icon">link_off</mat-icon>
        </div>
        <h1 class="error-title">Invalid or Expired Link</h1>
        <p class="error-message">
          The assignment link you followed is either invalid or has expired.
          Please check your email for a valid link or contact the EPCON coordination team.
        </p>
        <div class="error-actions">
          <a mat-flat-button color="primary" href="mailto:coordination@epcon.org" aria-label="Contact EPCON support by email">
            <mat-icon aria-hidden="true">email</mat-icon>
            Contact Support
          </a>
        </div>
        <div class="epcon-brand">
          <span class="brand-name">EPCON</span>
          <span class="brand-sub">Healthcare Worker Portal</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .error-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--epcon-bg);
      padding: 24px;
    }

    .error-card {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }

    .error-icon-wrap {
      margin-bottom: 16px;
    }

    .error-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: var(--epcon-declined);
      opacity: 0.8;
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--epcon-text);
      margin: 0 0 12px;
    }

    .error-message {
      font-size: 0.9rem;
      color: var(--epcon-text-muted);
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .error-actions {
      margin-bottom: 24px;
    }

    .epcon-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding-top: 16px;
      border-top: 1px solid var(--epcon-border);
    }

    .brand-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--epcon-cyan);
      letter-spacing: 3px;
    }

    .brand-sub {
      font-size: 0.75rem;
      color: var(--epcon-text-muted);
    }
  `],
})
export class ErrorPageComponent {}
