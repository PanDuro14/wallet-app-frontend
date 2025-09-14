import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';
import { DatePipe } from '@angular/common';

import { CreateDesingComponent } from '../create-desing/create-desing.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

type ID = number;

interface BusinessData {
  id: ID;
  name: string;
  email: string;
  default_card_detail_id: ID | null;
  logo?: { type: 'Buffer'; data: number[] };
  created_at?: string;
  updated_at?: string;
}

interface DesignJsonAssets { disableStrip: boolean; }
interface DesignJsonColors { label: string; background: string; foreground: string; }
interface DesignJsonBarcode {
  altText: string;
  message: string;
  primary?: string;
  encoding: string;
  additional: string[];
}

interface DesignJson {
  assets: DesignJsonAssets;
  colors: DesignJsonColors;
  barcode: DesignJsonBarcode;
  businessId: ID;
  hideAccount: boolean;
  programName: string;
}

interface DesignData {
  id: ID;
  business_id: ID;
  background_color?: string | null;
  foreground_color?: string | null;
  pass_type_id?: string | null;
  terms?: string | null;
  logo_url?: string | null;
  strip_image_url?: string | null;
  created_at: string;
  updated_at: string;
  design_json: DesignJson;
}

@Component({
  selector: 'app-desings-page',
  standalone: true,
  imports: [ CommonModule, RouterModule, HttpClientModule, BufferToBase64Pipe, FormsModule, MatDialogModule ],
  templateUrl: './desings-page.component.html',
  styleUrls: ['./desings-page.component.scss'],
  providers: [ DatePipe ]
})
export class DesingsPageComponent implements OnInit, OnDestroy {
  previewPoints = 10;
  previewMemberLabel = 'MEMBER';
  previewName = 'test';
  previewCode = 'fd1222a5-0f73-46e7-9018-591ea2c97aad';

  serverError = '';
  isLoading = false;

  currentBid = 0;
  currentBusiness: any[] = [];
  currentDesigns: any[] = [];

  private popStateHanlder?: () => void;
  private designById = new Map<number, DesignData>();
  designsRows: DesignData[] = [];

  // === NUEVO: estado de selección/flip ===
  selectedId: ID | null = null;
  flippedIds = new Set<ID>();
  flipSelected = false;

  constructor(
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private dialog: MatDialog,
    private http: HttpClient,
    private router: Router,
  ){}

  async ngOnInit(){
    this.isLoading = true;

    // businessId desde /:id o ?bid=
    const idParam = this.route.snapshot.paramMap.get('id') ?? this.route.snapshot.queryParamMap.get('bid');
    const id = Number(idParam ?? 0);

    if (!Number.isFinite(id) || id <= 0) {
      this.serverError = `Link inválido: falta o es incorrecto el business ID`;
      this.isLoading = false;
      return;
    }

    this.currentBid = id;

    // carga negocio + diseños
    try {
      await this.getBusinessInfo(id);
      await this.getDesigns(id);

      // set selected = default o primero
      const defaultId: ID | null = this.currentBusiness?.[0]?.default_card_detail_id ?? null;
      const hasDefault = defaultId && this.designById.has(defaultId);
      this.selectedId = hasDefault ? defaultId! : (this.designsRows[0]?.id ?? null);
    } catch (e: any) {
      this.serverError = e?.message ?? 'Fallo cargando la página';
    } finally {
      this.isLoading = false;
    }
  }

  async cargarInformacion(){
    await this.getBusinessInfo(this.currentBid);
    await this.getDesigns(this.currentBid);
    // mantener selección consistente
    if (this.selectedId && !this.designById.has(this.selectedId)) {
      this.selectedId = this.designsRows[0]?.id ?? null;
    }
  }

  private async getBusinessInfo(id: number){
    this.isLoading = true;
    this.serverError = '';

    try {
      const response = await firstValueFrom(this.http.get<any>(`${environment.urlApi}/business/${id}`));
      const b = response?.data ?? (Array.isArray(response) ? response[0] : response);
      if(!b) { this.currentBusiness = []; return; }

      const logoMimeType = b.logoMimeType || b.logo_mime_type || b.logo_mime || 'image/png';
      this.currentBusiness = [{
        ...b,
        logoMimeType,
        created_atFormat: this.formatDate(b.created_at),
        updated_atFormat: this.formatDate(b.updated_at),
      }];

    } catch (error: any) {
      this.serverError = error?.message || 'No se pudo obtener el negocio ';
      this.currentBusiness = [];
    } finally {
      this.isLoading = false;
    }
  }

  private async getDesigns(businessId: number) {
    this.serverError = '';
    try {
      const url = `${environment.urlApi}/cards/getByBusiness/${businessId}`;
      const resp = await firstValueFrom(this.http.get<any>(url));

      const raw =
        resp?.data ??
        resp?.rows ??
        (Array.isArray(resp) ? resp : (resp ? [resp] : []));

      const list: DesignData[] = (raw ?? []).map((d: any) => this.normalizeDesign(d));

      this.designsRows = list;
      this.currentDesigns = list.map(d => ({
        id: d.id,
        business_id: d.business_id,
        created_atFormat: this.formatDate(d.created_at),
        updated_atFormat: this.formatDate(d.updated_at),
        programName: d?.design_json?.programName ?? '',
        bg: d?.design_json?.colors?.background ?? d.background_color ?? '',
        fg: d?.design_json?.colors?.foreground ?? d.foreground_color ?? '',
        label: d?.design_json?.colors?.label ?? '',
      }));

      this.designById.clear();
      list.forEach(d => this.designById.set(d.id, d));
    } catch (error: any) {
      this.serverError = error?.message || 'No se pudieron obtener los diseños';
      this.designsRows = [];
      this.currentDesigns = [];
      this.designById.clear();
    }
  }

  private normalizeDesign(d: any): DesignData {
    const dj = d.design_json ?? d.designJson ?? {};
    const colors = dj.colors ?? {};
    const fixHex = (v: any, fallback: string) =>
      (typeof v === 'string' && /^#([0-9a-fA-F]{6})$/.test(v)) ? v : fallback;

    return {
      id: Number(d.id),
      business_id: Number(d.business_id ?? d.businessId ?? this.currentBid),
      background_color: d.background_color ?? d.backgroundColor ?? null,
      foreground_color: d.foreground_color ?? d.foregroundColor ?? null,
      pass_type_id: d.pass_type_id ?? d.passTypeId ?? null,
      terms: d.terms ?? null,
      logo_url: d.logo_url ?? d.logoUrl ?? null,
      strip_image_url: d.strip_image_url ?? d.stripImageUrl ?? null,
      created_at: d.created_at ?? d.createdAt ?? new Date().toISOString(),
      updated_at: d.updated_at ?? d.updatedAt ?? d.created_at ?? new Date().toISOString(),
      design_json: {
        assets: {
          disableStrip: Boolean(dj.assets?.disableStrip ?? true),
        },
        colors: {
          label: fixHex(colors.label, '#FFFFFF'),
          background: fixHex(colors.background, '#074f63'),
          foreground: fixHex(colors.foreground, '#E6E6E6'),
        },
        barcode: {
          altText: dj.barcode?.altText ?? '{{cardCode}}',
          message: dj.barcode?.message ?? '{{cardCode}}',
          primary: dj.barcode?.primary,
          encoding: dj.barcode?.encoding ?? 'iso-8859-1',
          additional: Array.isArray(dj.barcode?.additional) ? dj.barcode.additional : [],
        },
        businessId: Number(dj.businessId ?? d.business_id ?? this.currentBid),
        hideAccount: Boolean(dj.hideAccount ?? true),
        programName: dj.programName ?? (this.currentBusiness?.[0]?.name ?? 'Programa'),
      },
    };
  }

  // === helpers de UI ===
  get selectedDesign(): DesignData | null {
    return this.selectedId ? (this.designById.get(this.selectedId) ?? null) : null;
  }

  get othersDesigns(): DesignData[] {
    return this.designsRows.filter(d => d.id !== this.selectedId);
  }

  selectDesign(id: ID) {
    this.selectedId = id;
    this.flipSelected = false; // resetea flip al cambiar
  }

  toggleFlipSelected() { this.flipSelected = !this.flipSelected; }
  toggleFlip(id: ID) {
    this.flippedIds.has(id) ? this.flippedIds.delete(id) : this.flippedIds.add(id);
  }

  getCardStyle(d?: DesignData) {
    const dj = d?.design_json;
    return {
      '--card-bg': dj?.colors?.background || '#074f63',
      '--card-fg': dj?.colors?.foreground || '#E6E6E6',
      '--card-label': dj?.colors?.label || '#FFFFFF',
    } as any;
  }

  isDefault(id: ID) {
    return this.currentBusiness?.[0]?.default_card_detail_id === id;
  }

  async setDefault(id: ID) {
    if (!this.currentBid) return;
    this.isLoading = true;
    try {
      const url = `${environment.urlApi}/business/${this.currentBid}/design/default`;
      await firstValueFrom(this.http.post(url, { card_detail_id: id }));
      if (this.currentBusiness?.[0]) this.currentBusiness[0].default_card_detail_id = id;
      this.selectedId = id;
    } catch (e: any) {
      this.serverError = e?.error?.message ?? e?.message ?? 'Error al establecer diseño por defecto';
    } finally {
      this.isLoading = false;
    }
  }

  formatDate(v?: string | Date, fmt = 'dd/MM/yyyy HH:mm'): string {
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(v) : v;
    return this.datePipe.transform(d, fmt) ?? '—';
  }

  openCreateDesing(){
    const dialogCreateDesign = this.dialog.open(CreateDesingComponent, {
      panelClass: 'app-dialog',
      backdropClass: 'app-backdrop',
      autoFocus: false,
      restoreFocus: false
    });

    dialogCreateDesign.componentInstance.createdDesing.subscribe(() => {
      dialogCreateDesign.close();
      this.cargarInformacion();
    });
  }

  async deleteDesign(id: number){
    const dialogDelete = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: { mensaje: '¿Estás seguro que quieres eliminar este diseño?' }
    });

    const confirmed = await dialogDelete.afterClosed().toPromise();

    if (confirmed){
      try {
        // TODO: ajusta a tu ruta real si usas /business/:id/designs/:designId
        const response = await this.http.delete(`${environment.urlApi}/cards/${id}`).toPromise();
        await this.cargarInformacion();
        return response;
      } catch (error) {
        throw error;
      }
    } else {
      return null;
    }
  }

  async editDesing(id: number){
    const dialogEdit = this.dialog.open(CreateDesingComponent, {
      panelClass: 'app-dialog',
      backdropClass: 'app-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: id
    });

    dialogEdit.componentInstance.createdDesing.subscribe(() => {
      dialogEdit.close();
      this.cargarInformacion();
    });
  }

  // logo src desde el negocio actual
  get businessLogoSrc(): string | null {
    const b = this.currentBusiness?.[0];
    if (!b?.logo?.data?.length) return null;
    const mime = b.logoMimeType || 'image/png';
    // BufferToBase64Pipe lo usas en plantillas, aquí doy alternativa por si quieres usarlo directo
    const base64 = b.logo.data ? btoa(String.fromCharCode(...b.logo.data)) : '';
    return `data:${mime};base64,${base64}`;
  }

  ngOnDestroy(): void {
    this.popStateHanlder = undefined;
  }
}
