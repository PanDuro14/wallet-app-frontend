import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrCodeDisplayComponent } from './qr-code-display.component';

describe('QrCodeDisplayComponent', () => {
  let component: QrCodeDisplayComponent;
  let fixture: ComponentFixture<QrCodeDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrCodeDisplayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QrCodeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
