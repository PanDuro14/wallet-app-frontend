import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPointsStripsComponent } from './add-points-strips.component';

describe('AddPointsStripsComponent', () => {
  let component: AddPointsStripsComponent;
  let fixture: ComponentFixture<AddPointsStripsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPointsStripsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddPointsStripsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
