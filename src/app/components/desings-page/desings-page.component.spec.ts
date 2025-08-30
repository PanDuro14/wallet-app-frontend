import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesingsPageComponent } from './desings-page.component';

describe('DesingsPageComponent', () => {
  let component: DesingsPageComponent;
  let fixture: ComponentFixture<DesingsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesingsPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DesingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
