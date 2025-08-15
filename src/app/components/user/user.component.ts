// user.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService, RegisterResponse } from '../../services/user/user.service';
import { environment } from '../../../environments/environment.prod';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [HttpClientModule, CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  userRegisterForm!: FormGroup;
  loading = false;
  serverError = '';
  walletUrl: string | null | undefined = null;
  walletStatus: 'PENDING' | undefined;
  createdUserId: number | undefined;

  constructor(
    private router: Router,
    private userService: UserService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
  ) {
    this.userRegisterForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      business_id: [1, [Validators.required, Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    const bidParam = this.route.snapshot.queryParamMap.get('bid');
    const bid = Number(bidParam ?? 1);
    if (!Number.isFinite(bid) || bid <= 0) {
      this.serverError = 'Link inválido: falta o es incorrecto el Business ID.';
      return;
    }
    this.f['business_id'].setValue(bid);
    this.f['business_id'].disable();
  }

  get f() { return this.userRegisterForm.controls; }

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

    // Limpieza: NO mandes campos que ya no existen en tu schema
    delete regPayload.authentication_token;
    delete regPayload.strip_image_url;
    // No necesitas mandar serial_number: tu DB lo genera (uuid_generate_v4)
    delete regPayload.serial_number;
    // points solo si tu backend lo requiere; si no, quítalo:
    if (regPayload.points === undefined) delete regPayload.points;

    this.userService.register(regPayload).subscribe({
      next: (res: RegisterResponse) => {
        // 2) Construir cardCode y pedir link de Wallet
        const user = res.user;
        const businessId = (user as any).business_id ?? regPayload.business_id;

        const shortFromSerial = (user as any)?.serial_number?.split('-')?.[0]?.toUpperCase();
        const cardCode = shortFromSerial
          ? `CARD-${businessId}-${shortFromSerial}`
          : `CARD-${businessId}-${user.id}`;

        const walletBody = {
          cardCode,
          userName: user.name,
          programName: (environment as any).programName || 'Mi Programa',
          businessId
        };

        this.userService.createWalletLink(walletBody).subscribe({
          next: (w) => {
            this.walletUrl = w.url;
            this.walletStatus = undefined;
            this.createdUserId = user.id;
            this.loading = false;

            // Redirigir automáticamente
            if (walletWin) {
              walletWin.location.href = w.url;   // abre en la pestaña pre-abierta
              walletWin.focus?.();
            } else {
              window.open(w.url, '_blank');      // fallback si el navegador bloqueó
            }

            // Si prefieres abrir en la misma pestaña, usa:
            // window.location.href = w.url;
          },
          error: (err) => {
            if (walletWin) walletWin.close();    // cierra la pestaña vacía si falló
            this.walletUrl = null;
            this.walletStatus = 'PENDING';
            this.createdUserId = user.id;
            this.loading = false;
            this.serverError = err?.error?.message || 'No se pudo generar la tarjeta (Wallet).';
          }
        });
      },
      error: (err) => {
        if (walletWin) walletWin.close();
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
}
