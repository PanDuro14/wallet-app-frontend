import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusinessLinksComponent } from './business-links.component';

describe('BusinessLinksComponent', () => {
  let component: BusinessLinksComponent;
  let fixture: ComponentFixture<BusinessLinksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessLinksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusinessLinksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
