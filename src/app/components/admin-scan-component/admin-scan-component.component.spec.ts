import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminScanComponentComponent } from './admin-scan-component.component';

describe('AdminScanComponentComponent', () => {
  let component: AdminScanComponentComponent;
  let fixture: ComponentFixture<AdminScanComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminScanComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminScanComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
