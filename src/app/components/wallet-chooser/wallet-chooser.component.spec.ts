import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletChooserComponent } from './wallet-chooser.component';

describe('WalletChooserComponent', () => {
  let component: WalletChooserComponent;
  let fixture: ComponentFixture<WalletChooserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WalletChooserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WalletChooserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
