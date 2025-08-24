import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment.prod';
import type { Business } from '../business/business.service';

@Injectable({
  providedIn: 'root'
})
export class LinksServicesService {
  private base = environment.frontBase || (typeof window !== 'undefined' ? window.location.origin : '');

  buildBussinessLink(b: Pick<Business, 'id' | 'slug'>): string {
    return `${this.base}/registro?bid=${b.id}`;
  }


}
