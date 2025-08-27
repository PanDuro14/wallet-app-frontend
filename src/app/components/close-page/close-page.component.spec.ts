import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClosePageComponent } from './close-page.component';

describe('ClosePageComponent', () => {
  let component: ClosePageComponent;
  let fixture: ComponentFixture<ClosePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClosePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClosePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
