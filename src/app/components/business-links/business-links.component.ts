import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessService, Business } from '../../services/business/business.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-business-links',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './business-links.component.html',
  styleUrls: ['./business-links.component.scss']
})
export class BusinessLinksComponent implements OnInit {
  businesses: Business[] = [];
  base = environment.frontBase || (typeof window !== 'undefined' ? window.location.origin : '');

  constructor(private bizSvc: BusinessService) {}

  ngOnInit(): void {
    this.bizSvc.getAllBusinesses().subscribe({
      next: (b) => {
        this.businesses = b || [];
        console.log('negocios:', this.businesses); // <-- aquí sí imprime
      },
      error: (err) => {
        console.error('Error cargando negocios', err);
        this.businesses = [];
      }
    });
  }

  buildLink(b: Business) {
    return `${this.base}/registro?bid=${b.id}`;
    // con slug: return `${this.base}/${b.slug}/registro`;
  }

  async copy(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      alert('Link copiado');
    } catch {
      alert('No se pudo copiar. ¿Estás en HTTPS o localhost?');
    }
  }
}
