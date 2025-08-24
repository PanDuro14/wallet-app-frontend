import { TestBed } from '@angular/core/testing';

import { LinksServicesService } from './links-services.service';

describe('LinksServicesService', () => {
  let service: LinksServicesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LinksServicesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
