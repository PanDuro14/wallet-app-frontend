import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDesingComponent } from './create-desing.component';

describe('CreateDesingComponent', () => {
  let component: CreateDesingComponent;
  let fixture: ComponentFixture<CreateDesingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDesingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateDesingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
