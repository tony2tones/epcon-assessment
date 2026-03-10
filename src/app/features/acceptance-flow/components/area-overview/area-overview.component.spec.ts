import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AreaOverviewComponent } from './area-overview.component';

describe('AreaOverviewComponent', () => {
  let component: AreaOverviewComponent;
  let fixture: ComponentFixture<AreaOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AreaOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
