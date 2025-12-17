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
type RewardMode = 'single' | 'multi-tier'; // ✅ NUEVO

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
  rewardMode: RewardMode = 'single'; // ✅ NUEVO
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
      acceptTerms: [false, [Validators.requiredTrue]]
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
      await this.loadDefaultCardDesign();
    }
  }

  get f() { return this.userRegisterForm.controls; }

  async loadDefaultCardDesign() {
    try {
      if (!this.currentBusiness.length || !this.currentBusiness[0].default_card_detail_id) {
        console.warn('No hay default_card_detail_id en el negocio');
        return;
      }

      const defaultCardDetailId = this.currentBusiness[0].default_card_detail_id;

      const res = await this.http.get<any>(
        `${environment.urlApi}/cards/${defaultCardDetailId}`
      ).toPromise();

      const cardDetail = Array.isArray(res) ? res[0] : res;
      if (!cardDetail) {
        console.warn('No se encontró el diseño de tarjeta');
        return;
      }

      this.currentCardDetail = cardDetail;

      const designJson = cardDetail.design_json || {};
      this.cardType = designJson.cardType === 'strips' ? 'strips' : 'points';

      // ✅ NUEVO: Detectar si es multi-tier
      if (this.cardType === 'strips') {
        const stripsConfig = designJson.strips || {};

        // Si tiene array de rewards, es multi-tier
        if (Array.isArray(stripsConfig.rewards) && stripsConfig.rewards.length > 0) {
          this.rewardMode = 'multi-tier';
          console.log('🎯 Sistema multi-tier detectado:', {
            levels: stripsConfig.rewards.length,
            rewards: stripsConfig.rewards.map((r: any) => r.title)
          });
        } else {
          this.rewardMode = 'single';
          console.log('📍 Sistema single detectado:', {
            total: stripsConfig.total,
            reward: stripsConfig.rewardTitle
          });
        }
      }

      console.log('Tipo de tarjeta:', this.cardType);
      console.log('Modo de recompensas:', this.rewardMode);
      console.log('Card detail ID:', cardDetail.id);

    } catch (error) {
      console.error('Error al cargar diseño de tarjeta:', error);
      this.cardType = 'points';
      this.rewardMode = 'single';
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

  private getUserLanguage(): 'es' | 'en' {
    const lang = navigator.language || (navigator as any).userLanguage || 'en';
    return lang.toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  private getLoadingPageHTML(): string {
    const userLang = this.getUserLanguage();
    const message = userLang === 'es' ? 'Generando pase...' : 'Generating pass...';
    const subtitle = userLang === 'es' ? 'Por favor espera un momento' : 'Please wait a moment';

    return `
      <!DOCTYPE html>
      <html lang="${userLang}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${message}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f7fa;
            padding: 1rem;
          }
          .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
            padding: 3rem 2rem;
            max-width: 420px;
            width: 100%;
            text-align: center;
          }
          .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #e3e8ef;
            border-top: 4px solid #4A7BF7;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 2rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 0.75rem;
          }
          p {
            font-size: 0.95rem;
            color: #6b7280;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h1>${message}</h1>
          <p>${subtitle}</p>
        </div>
      </body>
      </html>
    `;
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
      walletWin.document.write(this.getLoadingPageHTML());
      walletWin.document.close();
    }

    const rawValues = this.userRegisterForm.getRawValue();

    let regPayload: any;
    let endpoint: string;

    if (this.cardType === 'strips') {
      // ✅ ACTUALIZADO: Usar endpoint unificado que detecta single/multi-tier automáticamente
      endpoint = `${environment.urlApi}/onboarding/users`;

      const designJson = this.currentCardDetail.design_json;
      const stripsConfig = designJson.strips || {};

      // ✅ IMPORTANTE: No enviar stripsRequired, rewardTitle, etc.
      // El backend los obtiene del design_json usando card_detail_id
      regPayload = {
        business_id: rawValues.business_id,
        name: rawValues.name.trim(),
        email: rawValues.email.trim(),
        phone: rawValues.phone?.trim() || '',
        card_detail_id: this.currentCardDetail.id, // ✅ CRÍTICO: Esto es lo que importa
        cardType: 'strips'
      };

      console.log('📦 Payload para strips:', {
        mode: this.rewardMode,
        card_detail_id: this.currentCardDetail.id,
        ...regPayload
      });

    } else {
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

      console.log('📦 Payload para points:', regPayload);
    }

    console.log('🚀 Enviando a:', endpoint);

    this.http.post<RegisterResponse>(endpoint, regPayload).subscribe({
      next: (res: RegisterResponse) => {
        const user = res.user;
        const businessId = (user as any).business_id ?? regPayload.business_id;
        const appleUrl = (res as any)?.wallet?.apple_pkpass_url as string | undefined;

        const pwaInstallUrl = (res as any)?.wallet?.pwa_install_url as string | undefined;
        const pwaWalletUrl = (res as any)?.wallet?.pwa_wallet_url as string | undefined;

        // ✅ NUEVO: Mostrar info de reward_system si viene
        const rewardSystem = (res as any)?.reward_system;
        if (rewardSystem) {
          console.log('🎯 Reward system configurado:', {
            type: rewardSystem.type,
            total_levels: rewardSystem.total_levels,
            current_level: rewardSystem.current_tier?.currentLevel,
            current_reward: rewardSystem.current_tier?.currentReward?.title
          });
        }

        this.loading = false;

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

        console.log('📱 Wallet URLs disponibles:', {
          apple: appleUrl,
          pwaInstall: pwaInstallUrl,
          pwaWallet: pwaWalletUrl
        });

        if (this.isIOS() && appleUrl) {
          console.log('🍎 Detectado iOS - Abriendo Apple Wallet');
          if (walletWin) {
            walletWin.location.href = appleUrl;
            walletWin.focus?.();
            redirectWalletWinToFinish(6000);
          } else {
            window.location.href = appleUrl;
          }
          return;
        }

        if (this.isAndroid() && pwaInstallUrl) {
          console.log('🤖 Detectado Android - Abriendo PWA Card');
          if (walletWin) {
            walletWin.location.href = pwaInstallUrl;
            walletWin.focus?.();
          } else {
            window.location.href = pwaInstallUrl;
          }
          return;
        }

        const pwaUrl = pwaInstallUrl || pwaWalletUrl;

        if (appleUrl || pwaUrl) {
          console.log('🖥️ Desktop/otros - Abriendo chooser');
          if (walletWin) walletWin.close();

          const dialogRef = this.dialog.open(WalletChooserComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: 'app-dialog',
            backdropClass: 'app-backdrop',
            data: {
              appleUrl,
              googleUrl: pwaUrl,
              isPwa: true
            }
          });

          dialogRef.afterClosed().subscribe((choice: 'apple' | 'google' | undefined) => {
            if (!choice) return;
            const url = choice === 'apple' ? appleUrl : pwaUrl;
            if (!url) return;
            const win = window.open(url, '_blank');
            if (!win) window.location.href = url;
            this.router.navigate(['finish-register', businessId], { replaceUrl: true });
          });
        } else {
          console.error('❌ No se recibieron URLs de wallet');
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
