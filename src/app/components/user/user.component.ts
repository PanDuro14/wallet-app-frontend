// user.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { UserService, RegisterResponse } from '../../services/user/user.service';
import { environment } from '../../../environments/environment';
import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { WalletChooserComponent } from '../wallet-chooser/wallet-chooser.component';
import { Router } from '@angular/router';

const UUIDv4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Component({
  selector: 'app-user',
  standalone: true,
  imports: [HttpClientModule, CommonModule, RouterModule, ReactiveFormsModule, BufferToBase64Pipe, MatDialogModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  userRegisterForm!: FormGroup;
  loading = false;
  serverError = '';
  currentBid = 0;
  currentBusiness: any[] = [];
  walletUrl: string | null | undefined = null;
  walletStatus: 'PENDING' | undefined;
  createdUserId: number | undefined;

  constructor(
    private userService: UserService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private http: HttpClient,
    private fb: FormBuilder,
    private router: Router,
  ) {
    this.userRegisterForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      business_id: [1, [Validators.required, Validators.min(1)]],
      points: [0],

    });
  }

  async ngOnInit(){
    const bidParam = this.route.snapshot.queryParamMap.get('bid');
    const bid = Number(bidParam ?? 1);
    if (!Number.isFinite(bid) || bid <= 0) {
      this.serverError = 'Link inválido: falta o es incorrecto el Business ID.';
      return;
    }
    this.f['business_id'].setValue(bid);
    this.f['business_id'].disable();
    this.currentBid = bid;
    if(this.currentBid){
      await this.getBusinessInfo(bid);
      console.log(this.currentBusiness);
    }
  }

  get f() { return this.userRegisterForm.controls; }

  private isAndroid(): boolean {
    // userAgentData (nuevo) o userAgent (fallback)
    // Nota: en iOS, Chrome/Edge dicen "CriOS"/"EdgiOS" y NO deben contar como Android
    const ua = navigator.userAgent || '';
    const uaDataBrands = (navigator as any).userAgentData?.brands?.map((b: any) => b.brand.toLowerCase()) || [];
    const uaDataPlatform = (navigator as any).userAgentData?.platform?.toLowerCase() || '';
    if (uaDataPlatform.includes('android') || uaDataBrands.some((b: string) => b.includes('android'))) return true;
    return /android/i.test(ua);
  }

  private isIOS(): boolean {
    const ua = navigator.userAgent || '';
    // iPhone/iPad/iPod, y también iPadOS que reporta MacIntel con touch
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const iPadOS = (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    return iOS || iPadOS;
  }

  onSubmit() {
    this.serverError = '';
    if (this.userRegisterForm.invalid) {
      this.userRegisterForm.markAllAsTouched();
      return;
    }
    this.loading = true;

    // Pre-abrimos una pestaña para evitar bloqueos de pop-up
    const walletWin = window.open('', '_blank');
    if (walletWin) {
      walletWin.document.write('<p style="font-family:sans-serif;">Generando tarjeta…</p>');
    }

    // 1) Payload de registro (incluye business_id deshabilitado)
    const regPayload: any = this.userRegisterForm.getRawValue();

    // aseguramos que points siempre sea 10
    regPayload.points = 10;

    // Limpieza: NO mandes campos que ya no existen en tu schema
    delete regPayload.authentication_token;
    delete regPayload.strip_image_url;
    // No necesitas mandar serial_number: tu DB lo genera (uuid_generate_v4)
    delete regPayload.serial_number;
    // points solo si tu backend lo requiere; si no, quítalo:
    if (regPayload.points === undefined) delete regPayload.points;

    this.userService.register(regPayload).subscribe({
      next: (res: RegisterResponse) => {
        const user = res.user;
        const businessId = (user as any).business_id ?? regPayload.business_id;

        // URLs que ya te da el backend en el registro:
        const appleUrl = (res as any)?.wallet?.apple_pkpass_url as string | undefined;
        const googleUrl = (res as any)?.wallet?.google_save_url as string | undefined;

        // Si necesitas aún crear algo en backend, mantenlo; pero la navegación usa apple/google de arriba
        // this.userService.createWalletLink(walletBody).subscribe({ ... });

        this.loading = false;

        // 1) iOS -> Apple Wallet
        if (this.isIOS() && appleUrl) {
          if (walletWin) { walletWin.location.href = appleUrl; walletWin.focus?.(); }
          else { window.location.href = appleUrl; }
          this.router.navigate(['/finish-register', businessId], { replaceUrl: true });
          return;
        }

        // 2) Android -> Google Wallet
        if (this.isAndroid() && googleUrl) {
          if (walletWin) { walletWin.location.href = googleUrl; walletWin.focus?.(); }
          else { window.location.href = googleUrl; }
          this.router.navigate(['/finish-register', businessId], { replaceUrl: true });
          return;
        }

        // 3) Desktop / otros -> chooser
        const target = googleUrl || appleUrl;
        if (target) {
          if (walletWin) walletWin.close(); // <- MUY IMPORTANTE: cierra la about:blank
          const dialogRef = this.dialog.open(WalletChooserComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: 'app-dialog',
            backdropClass: 'app-backdrop',
            data: { appleUrl, googleUrl }
          });
          dialogRef.afterClosed().subscribe((choice: 'apple' | 'google' | undefined) => {
            if (!choice) return;
            const url = choice === 'apple' ? appleUrl : googleUrl;
            if (!url) return;
            const win = window.open(url, '_blank');
            if (!win) window.location.href = url;

            this.router.navigate(['/finish-register', businessId], { replaceUrl: true });
          });
        } else {
          if (walletWin) walletWin.close();
          this.serverError = 'No se recibió una URL válida de Wallet.';
        }
      },
      error: (err) => {
        if (walletWin) walletWin.close(); // <- cerrar la pestaña pre-abierta en error
        console.error('REGISTER ERROR', { status: err?.status, body: err?.error });
        this.loading = false;
        this.serverError = err?.error?.message || 'Error al registrar usuario';
      }
    });
  }

  retryWallet() {
    if (!this.createdUserId) return;
    this.loading = true;
    this.userService.retryWallet(this.createdUserId).subscribe({
      next: (res) => {
        this.loading = false;
        this.walletUrl = res.walletUrl;
        this.walletStatus = undefined;

        // Autoabrir también en reintento
        if (this.walletUrl) {
          const win = window.open(this.walletUrl, '_blank');
          if (!win) window.location.href = this.walletUrl;
        }
      },
      error: (err) => {
        this.loading = false;
        this.serverError = err?.error?.message || 'No se pudo generar la tarjeta';
      }
    });
  }

  // (opcional) Fallback si el navegador no tiene crypto.randomUUID
  private fallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  }

   async getBusinessInfo(id: number){
    try {
      if(!id) {
        console.log('ID no disponible');
        return;
      }

      const res = await this.http.get<any>(`${environment.urlApi}/business/${id}`).toPromise();
      const b = Array.isArray(res) ? res[0] : res;
      if (!b) {
        console.warn('No se encontró el negocio');
        this.currentBusiness = [];
        return;
      }

      const logoMimeType =
        b.logoMimeType || b.logo_mime_type || b.logo_mime || 'image/png';

      this.currentBusiness = [{ ...b, logoMimeType }];

    } catch (error:any){
      console.error('Error al obtener el business', error);
      this.currentBusiness = [];
      this.serverError = error?.message || 'No se pudo obtener el negocio';
    }
  }
}
