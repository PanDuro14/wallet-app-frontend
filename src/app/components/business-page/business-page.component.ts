import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { HttpClient, HttpClientModule } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';
import { DatePipe } from '@angular/common';

import { LinksServicesService } from '../../services/linksServices/links-services.service';
import { WalletService } from '../../services/wallet/wallet.service';
import { AuthService } from '../../services/auth/auth.service';

import { MatDialog } from '@angular/material/dialog';
import { AdminScanComponentComponent } from '../admin-scan-component/admin-scan-component.component';

// Usuarios
export interface UserApi {
  id: number;
  name: string;
  email: string;
  phone?: string;
  business_id: number;
  points: number;
  serial_number: string;
  created_at: string;
  updated_at: string;
  loyalty_account_id?: string;
  wallet_url?: string | null;
  wallet_added?: boolean;
  wallet_added_at?: string | null;
  apple_auth_token?: string;
  apple_pass_type_id?: string;
  card_detail_id?: number;
}

export type UserRow = Pick<UserApi, 'id'|'name'|'email'|'points'> & {
  created_atFormat: string;
  updated_atFormat: string;
  hasWallet: boolean;
};

// ModalSatte
type AdjustModalState = {
  open: boolean;
  busy: boolean;
  error: string;
  userId: number | null;
  name: string;
  email: string;
  serial: string;
  currentPoints: number;
  delta: number;
};

@Component({
  selector: 'app-business-page',
  standalone: true,
  imports: [ CommonModule, RouterModule, HttpClientModule, BufferToBase64Pipe, FormsModule ],
  templateUrl: './business-page.component.html',
  styleUrl: './business-page.component.scss',
  providers: [ DatePipe ]
})

export class BusinessPageComponent implements OnInit, OnDestroy {
  serverError = '';
  isLoading = false;

  currentBid = 0;
  currentBusiness: any[] = [];
  currentUsers: any[] = [];

  businessLink: string | null = null;

  private popStateHandler?: () => void;
  private usersById = new Map<number, UserApi>();
  userRows: UserRow[] = [];

  // Inicializar el modal
  adjust: AdjustModalState = {
    open: false, busy: false, error: '',
    userId: null, name: '', email: '',
    serial: '', currentPoints: 0, delta: 0
  };

  constructor(
    public links: LinksServicesService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private wallet: WalletService,
    private datePipe: DatePipe,
    private dialog: MatDialog,
    private http: HttpClient,
    private router: Router,
  ) {}

  private toRow = (u: UserApi): UserRow => ({
    id: u.id,
    name: u.name,
    email: u.email,
    points: u.points,
    created_atFormat: this.formatDate(u.created_at),
    updated_atFormat: this.formatDate(u.updated_at),
    hasWallet: !!u.wallet_added || !!u.wallet_url,
  });

  private setUsers(list: UserApi[]) {
    this.usersById = new Map(list.map(u => [u.id, u]));
    this.userRows = list.map(this.toRow);
  }

  private upsertUser(u: UserApi) {
    this.usersById.set(u.id, u);
    const i = this.userRows.findIndex(r => r.id === u.id);
    const row = this.toRow(u);
    if (i >= 0) {
      this.userRows = [
        ...this.userRows.slice(0, i),
        row,
        ...this.userRows.slice(i + 1),
      ];
    } else {
      this.userRows = [row, ...this.userRows];
    }
  }

  async ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id')
               ?? this.route.snapshot.queryParamMap.get('bid');
    const id = Number(idParam ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      this.serverError = 'Link inválido: falta o es incorrecto el Business ID';
      return;
    }

    this.currentBid = id;
    await this.getBusinessInfo(id);
    this.getLinkById(id);

    // (Opcional) bloquear back y redirigir
    history.replaceState(null, '', location.href);
    this.popStateHandler = () => {
      this.router.navigate(['/finish-register'], { queryParams: { bid: this.currentBid }, replaceUrl: true });
    };
    window.addEventListener('popstate', this.popStateHandler);
  }

  async ngOnDestroy() {
    if (this.popStateHandler) {
      window.removeEventListener('popstate', this.popStateHandler);
    }
  }

  private async getBusinessInfo(id: number){
    this.isLoading = true;
    this.serverError = '';
    try {
      const resp = await firstValueFrom(this.http.get<any>(`${environment.urlApi}/business/${id}`));

      const b = resp?.data ?? (Array.isArray(resp) ? resp[0] : resp);
      if (!b) { this.currentBusiness = []; return; }

      const logoMimeType = b.logoMimeType || b.logo_mime_type || b.logo_mime || 'image/png';

      this.currentBusiness = [{
        ...b,
        logoMimeType,
        created_atFormat: this.formatDate(b.created_at),
        updated_atFormat: this.formatDate(b.updated_at),
      }];

      this.businessLink = this.links.buildBussinessLink(this.currentBusiness[0]);
      console.log('businessLink:', this.businessLink);

      await this.getAllUsesByBusiness(id);
    } catch (error: any){
      this.serverError = error?.message || 'No se pudo obtener el negocio';
      this.currentBusiness = [];
    } finally {
      this.isLoading = false;
    }
  }

  async cargarInformacion(){
    await this.getBusinessInfo(this.currentBid);
    this.getLinkById(this.currentBid);
  }

  trackById = (_: number, r: UserRow) => r.id;

  async getAllUsesByBusiness(id: number){
    try {
      const resp = await firstValueFrom(
        this.http.get<UserApi[] | { data: UserApi[] }>(`${environment.urlApi}/users/business/${id}`)
      );
      const list: UserApi[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.setUsers(list);
    } catch (e) {
      console.error('Error al obtener usuarios:', e);
      this.usersById.clear();
      this.userRows = [];
    }
  }


  // Acciones rápidas (wire-ups a futuro)
  onIssuePass() {
    const id = this.currentBid;
    this.router.navigate(['/registro'], { queryParams: { bid: id } });
  }

  async adminDesings(id: number) {await this.router.navigate(['/desings', String(id)]);}
  onDeleteUser(user: UserRow) { console.log('Eliminar usuario →', user); /* TODO: confirm + llamada API */ }

  private getLinkById(id: number): string | null {
    const b = this.currentBusiness.find(x => x.id === id);
    return b ? this.links.buildBussinessLink(b) : null;
  }


  formatDate(v?: string | Date, fmt = 'dd/MM/yyyy HH:mm'): string {
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(v) : v;
    return this.datePipe.transform(d, fmt) ?? '—';
  }

  onOpenAdjust() {
    const dialogAdmin = this.dialog.open(AdminScanComponentComponent, {
      panelClass: 'app-dialog',
      backdropClass: 'app-backdrop',
      autoFocus: false,
      restoreFocus: false,
    });

    dialogAdmin.componentInstance.bumpedPoints.subscribe(() => {
      dialogAdmin.close();
      this.cargarInformacion();
    });
  }

  openUpdatePoints(userId: number){
    const raw = this.usersById.get(userId);
    if (!raw) {
      this.serverError = 'Usuario no encontrado en caché';
      return;
    }
    if (!raw.serial_number) {
      this.serverError = 'Usuario sin serial_number';
      return;
    }

    this.adjust = {
      open: true, busy: false, error: '',
      userId: raw.id,
      name: raw.name,
      email: raw.email || '',
      serial: raw.serial_number,
      currentPoints: raw.points ?? 0,
      delta: 0,
    };
  }

  onCloseAdjust(){
    this.adjust.open = false;
    this.adjust.error = '';
    this.adjust.delta = 0;
  }

  bump(n: number){ this.adjust.delta = Number(this.adjust.delta || 0) + n; }

  canApply(): boolean {
    const d = Number(this.adjust.delta);
    return this.adjust.open && !this.adjust.busy && Number.isFinite(d) && d != 0;
  }

  async applyAdjust() {
    if (!this.canApply() || this.adjust.userId == null) return;
    const { serial, delta, userId } = this.adjust;
    this.adjust.busy = true; this.adjust.error = '';

    // Confirmación para movimientos grandes o negativos
    const big = Math.abs(Number(delta)) >= 200 || Number(delta) < 0;
    if (big && !confirm(`Vas a aplicar un ajuste de ${delta} puntos. ¿Confirmas?`)) {
      this.adjust.busy = false; return;
    }

    try {
      await firstValueFrom(this.wallet.updatePoints(serial, Number(delta)));
      const fresh = await firstValueFrom(
        this.http.get<UserApi>(`${environment.urlApi}/users/${userId}`)
      );
      this.upsertUser(fresh);
      this.onCloseAdjust();
    } catch (e: any) {
      this.adjust.error = e?.error?.message || 'No se pudo actualizar los puntos';
    } finally {
      this.adjust.busy = false;
    }
  }

  logout(){
    this.authService.logout();
  }
}
