// services/wallet/wallet.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

// ===== INTERFACES APPLE WALLET =====
interface StripResponse {
  ok: boolean;
  strips_collected: number;
  strips_required: number;
  strip_number?: number;
  isComplete: boolean;
  reward_title: string;
  userName: string;
  notified: number;
  message: string;
  error?: string;
}

interface ResetResponse {
  ok: boolean;
  strips_collected: number;
  strips_required: number;
  reward_title: string;
  isComplete: boolean;
  notified: number;
  message: string;
}

// ===== INTERFACES PWA WALLET =====
interface PwaUpdatePointsResponse {
  ok: boolean;
  points: number;
  previous_points?: number;
}

interface PwaUpdateStripsResponse {
  ok: boolean;
  strips_collected: number;
  strips_required: number;
  reward_title: string;
  isComplete: boolean;
}

interface PwaResetStripsResponse {
  ok: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  constructor(private http: HttpClient) { }

  // ===== MÉTODOS APPLE WALLET =====
  updatePoints(passSerial: string, delta: number): Observable<{ message?: string; ok?: boolean; points?: number }> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/points`;
    return this.http.post<{ message?: string; ok?: boolean; points?: number }>(url, { delta });
  }

  updateStrips(passSerial: string, stripNumber: number): Observable<StripResponse> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/strips`;
    return this.http.post<StripResponse>(url, { stripNumber });
  }

  resetStrips(passSerial: string, redeemed: boolean = false): Observable<ResetResponse> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/reset-strips`;
    return this.http.post<ResetResponse>(url, { redeemed });
  }

  // ===== MÉTODOS PWA WALLET =====
  pwaUpdatePoints(serial: string, delta: number): Observable<PwaUpdatePointsResponse> {
    const url = `${environment.urlApiWallet}/wallet/update-points`;
    return this.http.post<PwaUpdatePointsResponse>(url, { serial, delta });
  }

  pwaAddStamp(serial: string, stripNumber: number): Observable<PwaUpdateStripsResponse> {
    const url = `${environment.urlApiWallet}/wallet/add-stamp`;
    return this.http.post<PwaUpdateStripsResponse>(url, { serial, stripNumber });
  }

  pwaResetStrips(serial: string, redeemed: boolean = false): Observable<PwaResetStripsResponse> {
    const url = `${environment.urlApiWallet}/wallet/reset-strips`;
    return this.http.post<PwaResetStripsResponse>(url, { serial, redeemed });
  }

  pwaGetCardData(serial: string): Observable<any> {
    const url = `${environment.urlApiWallet}/wallet/${serial}`;
    return this.http.get(url);
  }

  // ===== MÉTODOS AUTO (DETECTAN TIPO AUTOMÁTICAMENTE) =====

  /**
   * ✅ SOLUCIÓN CON FALLBACK: Intentar Apple primero, luego PWA
   * Si el tipo es explícito, lo usa. Si no, intenta Apple primero y si falla, usa PWA
   */
  updatePointsAuto(serial: string, delta: number, walletType?: 'pwa' | 'apple'): Observable<any> {
    console.log('🔍 [WalletService] updatePointsAuto:', { serial, delta, walletType });

    if (walletType === 'apple') {
      console.log('🍎 [WalletService] Forzando Apple Wallet (tipo explícito)');
      return this.updatePoints(serial, delta);
    } else if (walletType === 'pwa') {
      console.log('📱 [WalletService] Forzando PWA (tipo explícito)');
      return this.pwaUpdatePoints(serial, delta);
    }

    // ⚠️ FALLBACK: Sin tipo explícito, intentar Apple primero
    console.log('⚠️ [WalletService] Sin tipo explícito, intentando Apple Wallet primero...');
    return new Observable(observer => {
      this.updatePoints(serial, delta).subscribe({
        next: (res) => {
          console.log('✅ [WalletService] Apple Wallet funcionó');
          observer.next(res);
          observer.complete();
        },
        error: (err) => {
          console.log('❌ [WalletService] Apple Wallet falló, intentando PWA...');
          this.pwaUpdatePoints(serial, delta).subscribe({
            next: (res) => {
              console.log('✅ [WalletService] PWA funcionó');
              observer.next(res);
              observer.complete();
            },
            error: (err2) => {
              console.error('❌ [WalletService] Ambos fallaron');
              observer.error(err2);
            }
          });
        }
      });
    });
  }

  updateStripsAuto(serial: string, stripNumber: number, walletType?: 'pwa' | 'apple'): Observable<any> {
    console.log('🔍 [WalletService] updateStripsAuto:', { serial, stripNumber, walletType });

    if (walletType === 'apple') {
      console.log('🍎 [WalletService] Forzando Apple Wallet (tipo explícito)');
      return this.updateStrips(serial, stripNumber);
    } else if (walletType === 'pwa') {
      console.log('📱 [WalletService] Forzando PWA (tipo explícito)');
      return this.pwaAddStamp(serial, stripNumber);
    }

    // ⚠️ FALLBACK: Sin tipo explícito, intentar Apple primero
    console.log('⚠️ [WalletService] Sin tipo explícito, intentando Apple Wallet primero...');
    return new Observable(observer => {
      this.updateStrips(serial, stripNumber).subscribe({
        next: (res) => {
          console.log('✅ [WalletService] Apple Wallet funcionó');
          observer.next(res);
          observer.complete();
        },
        error: (err) => {
          console.log('❌ [WalletService] Apple Wallet falló, intentando PWA...');
          this.pwaAddStamp(serial, stripNumber).subscribe({
            next: (res) => {
              console.log('✅ [WalletService] PWA funcionó');
              observer.next(res);
              observer.complete();
            },
            error: (err2) => {
              console.error('❌ [WalletService] Ambos fallaron');
              observer.error(err2);
            }
          });
        }
      });
    });
  }

  resetStripsAuto(serial: string, redeemed: boolean = false, walletType?: 'pwa' | 'apple'): Observable<any> {
    console.log('🔍 [WalletService] resetStripsAuto:', { serial, redeemed, walletType });

    if (walletType === 'apple') {
      console.log('🍎 [WalletService] Forzando Apple Wallet (tipo explícito)');
      return this.resetStrips(serial, redeemed);
    } else if (walletType === 'pwa') {
      console.log('📱 [WalletService] Forzando PWA (tipo explícito)');
      return this.pwaResetStrips(serial, redeemed);
    }

    // ⚠️ FALLBACK: Sin tipo explícito, intentar Apple primero
    console.log('⚠️ [WalletService] Sin tipo explícito, intentando Apple Wallet primero...');
    return new Observable(observer => {
      this.resetStrips(serial, redeemed).subscribe({
        next: (res) => {
          console.log('✅ [WalletService] Apple Wallet funcionó');
          observer.next(res);
          observer.complete();
        },
        error: (err) => {
          console.log('❌ [WalletService] Apple Wallet falló, intentando PWA...');
          this.pwaResetStrips(serial, redeemed).subscribe({
            next: (res) => {
              console.log('✅ [WalletService] PWA funcionó');
              observer.next(res);
              observer.complete();
            },
            error: (err2) => {
              console.error('❌ [WalletService] Ambos fallaron');
              observer.error(err2);
            }
          });
        }
      });
    });
  }

  // ===== MÉTODOS DE DETECCIÓN =====

  /**
   * ✅ DETECCIÓN MEJORADA: Identifica si es Apple Wallet o PWA
   *
   * Apple Wallet tiene 3 formatos posibles:
   * 1. pass.com.empresa.loyalty.XXXXX (formato clásico)
   * 2. pass.mx.windoe.loyalty/UUID (formato con slash)
   * 3. Cualquier string que contenga "pass." al inicio
   *
   * PWA:
   * 1. UUID puro: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  private isAppleWalletSerial(serial: string): boolean {
    // Estrategia 1: Detectar formato "pass.xxxx"
    if (serial.startsWith('pass.')) {
      console.log('✅ [Detection] Formato Apple Wallet detectado (empieza con "pass.")');
      return true;
    }

    // Estrategia 2: Detectar formato con slash "pass.xxx/uuid"
    if (serial.includes('pass.') && serial.includes('/')) {
      console.log('✅ [Detection] Formato Apple Wallet detectado (contiene "pass." y "/")');
      return true;
    }

    // Estrategia 3: Si es UUID puro, es PWA
    if (this.isUUID(serial)) {
      console.log('✅ [Detection] Formato PWA detectado (UUID puro)');
      return false; // Es PWA
    }

    // Por defecto: Si no es UUID, asumimos que es Apple Wallet
    console.log('⚠️ [Detection] Formato desconocido, asumiendo Apple Wallet');
    return true;
  }

  /**
   * Verifica si un string es un UUID válido (formato PWA)
   */
  private isUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
