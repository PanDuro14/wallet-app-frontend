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

type CardType = 'points' | 'strips';

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
  currentCardDetail: any = null;
  cardType: CardType = 'points';
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
      acceptTerms: [false, [Validators.requiredTrue]] // El checkbox debe ser true
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
      // Cargar el diseño de tarjeta predeterminado del negocio
      await this.loadDefaultCardDesign();
    }
  }

  get f() { return this.userRegisterForm.controls; }

  /**
   * Carga el diseño de tarjeta predeterminado usando default_card_detail_id del negocio
   */
  async loadDefaultCardDesign() {
    try {
      if (!this.currentBusiness.length || !this.currentBusiness[0].default_card_detail_id) {
        console.warn('No hay default_card_detail_id en el negocio');
        return;
      }

      const defaultCardDetailId = this.currentBusiness[0].default_card_detail_id;

      // Obtener el diseño específico por ID
      const res = await this.http.get<any>(
        `${environment.urlApi}/cards/${defaultCardDetailId}`
      ).toPromise();

      const cardDetail = Array.isArray(res) ? res[0] : res;
      if (!cardDetail) {
        console.warn('No se encontró el diseño de tarjeta');
        return;
      }

      this.currentCardDetail = cardDetail;

      // Detectar tipo desde design_json
      const designJson = cardDetail.design_json || {};
      this.cardType = designJson.cardType === 'strips' ? 'strips' : 'points';

      console.log('Tipo de tarjeta detectado:', this.cardType);
      console.log('Card detail ID:', cardDetail.id);

    } catch (error) {
      console.error('Error al cargar diseño de tarjeta:', error);
      // Si falla, usar points por defecto
      this.cardType = 'points';
    }
  }

  private isAndroid(): boolean {
    const ua = navigator.userAgent || '';
    const uaDataBrands = (navigator as any).userAgentData?.brands?.map((b: any) => b.brand.toLowerCase()) || [];
    const uaDataPlatform = (navigator as any).userAgentData?.platform?.toLowerCase() || '';
    if (uaDataPlatform.includes('android') || uaDataBrands.some((b: string) => b.includes('android'))) return true;
    return /android/i.test(ua);
  }

  private isIOS(): boolean {
    const ua = navigator.userAgent || '';
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

    if (!this.currentCardDetail) {
      this.serverError = 'No se pudo detectar el tipo de tarjeta del negocio';
      return;
    }

    this.loading = true;

    const walletWin = window.open('', '_blank');
    if (walletWin) {
      walletWin.document.write('<p style="font-family:sans-serif;">Generando tarjeta…</p>');
    }

    const rawValues = this.userRegisterForm.getRawValue();

    // Construir payload según el tipo detectado
    let regPayload: any;
    let endpoint: string;

    if (this.cardType === 'strips') {
      // Payload para STRIPS
      endpoint = `${environment.urlApi}/onboarding/users/strips`;

      const designJson = this.currentCardDetail.design_json;
      const stripsConfig = designJson.strips || {};

      regPayload = {
        business_id: rawValues.business_id,
        name: rawValues.name.trim(),
        email: rawValues.email.trim(),
        phone: rawValues.phone?.trim() || '',
        card_detail_id: this.currentCardDetail.id,
        stripsRequired: Number(stripsConfig.total) || 8,
        rewardTitle: stripsConfig.rewardTitle || 'Premio',
        rewardDescription: stripsConfig.rewardDescription || '',
        variant: 'strips'
      };
    } else {
      // Payload para POINTS (original)
      endpoint = `${environment.urlApi}/onboarding/users`;
      regPayload = {
        business_id: rawValues.business_id,
        name: rawValues.name.trim(),
        email: rawValues.email.trim(),
        phone: rawValues.phone?.trim() || '',
        card_detail_id: this.currentCardDetail.id,
        points: 0,
        cardType: 'points'
      };
    }

    console.log('Enviando a:', endpoint);
    console.log('Payload:', regPayload);

    // Realizar el registro con el endpoint correcto
    this.http.post<RegisterResponse>(endpoint, regPayload).subscribe({
      next: (res: RegisterResponse) => {
        const user = res.user;
        const businessId = (user as any).business_id ?? regPayload.business_id;
        const appleUrl = (res as any)?.wallet?.apple_pkpass_url as string | undefined;
        const googleUrl = (res as any)?.wallet?.google_save_url as string | undefined;

        this.loading = false;

        // const finishUrl = `${location.origin}/finish-register/${businessId}`;
        const pathLang = location.pathname.split('/')[1];
        const supportedLangs = ['es', 'en'];
        const langPrefix = supportedLangs.includes(pathLang) ? `/${pathLang}` : '';
        const finishUrl = `${location.origin}${langPrefix}/finish-register/${businessId}`;

        const redirectWalletWinToFinish = (delayMs = 5000) => {
          if (!walletWin) return;
          try {
            setTimeout(() => {
              try { walletWin.location.href = finishUrl; } catch {}
            }, delayMs);
          } catch {}
        };

        // iOS -> Apple Wallet
        if (this.isIOS() && appleUrl) {
          if (walletWin) {
            walletWin.location.href = appleUrl;
            walletWin.focus?.();
            redirectWalletWinToFinish(6000);
          } else {
            window.location.href = appleUrl;
          }
          return;
        }

        // Android -> Google Wallet
        if (this.isAndroid() && googleUrl) {
          if (walletWin) {
            walletWin.location.href = googleUrl;
            walletWin.focus?.();
            redirectWalletWinToFinish(7000);
          } else {
            window.location.href = googleUrl;
          }
          return;
        }

        // Desktop / otros -> chooser
        const target = googleUrl || appleUrl;
        if (target) {
          if (walletWin) walletWin.close();
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
            this.router.navigate(['finish-register', businessId], { replaceUrl: true });
          });
        } else {
          if (walletWin) walletWin.close();
          this.serverError = 'No se recibió una URL válida de Wallet.';
        }
      },
      error: (err) => {
        if (walletWin) walletWin.close();
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
