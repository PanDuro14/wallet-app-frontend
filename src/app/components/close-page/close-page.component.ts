import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';

@Component({
  selector: 'app-close-page',
  standalone: true,
  imports: [ CommonModule, RouterModule, HttpClientModule, BufferToBase64Pipe ],
  templateUrl: './close-page.component.html',
  styleUrls: ['./close-page.component.scss']
})
export class ClosePageComponent implements OnInit, OnDestroy {

  serverError = '';
  currentBid = 0;
  currentBusiness: any[] = [];

  private popStateHandler?: () => void;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  async ngOnInit() {
    // 1) lee :id de la URL (param de ruta)
    const idParam = this.route.snapshot.paramMap.get('id'); // <- aquí
    const bid = Number(idParam ?? 0);
    if (!Number.isFinite(bid) || bid <= 0) {
      this.serverError = 'Link inválido: falta o es incorrecto el Business ID.';
      return;
    }
    this.currentBid = bid;

    // 2) datos del negocio
    await this.getBusinessInfo(bid);

    // 3) bloquear volver (opcional)
    history.replaceState(null, '', location.href);
    this.popStateHandler = () => {
      this.router.navigate(
        ['/finish-register', this.currentBid], // <- aquí
        { replaceUrl: true }
      );
    };
    window.addEventListener('popstate', this.popStateHandler);
  }


  ngOnDestroy() {
    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
    }
  }

  private async getBusinessInfo(id: number) {
    try {
      const res = await firstValueFrom(this.http.get<any>(`${environment.urlApi}/business/${id}`));
      const b = Array.isArray(res) ? res[0] : res;
      if (!b) { this.currentBusiness = []; return; }
      const logoMimeType = b.logoMimeType || b.logo_mime_type || b.logo_mime || 'image/png';
      this.currentBusiness = [{ ...b, logoMimeType }];
    } catch (err: any) {
      this.serverError = err?.message || 'No se pudo obtener el negocio';
      this.currentBusiness = [];
    }
  }
}
