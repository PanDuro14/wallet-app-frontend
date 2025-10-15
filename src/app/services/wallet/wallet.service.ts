import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  constructor(private http: HttpClient) { }

  updatePoints(passSerial: string, delta: number): Observable<{ message?: string; ok?: boolean; points?: number }> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/points`;
    return this.http.post<{ message?: string; ok?: boolean; points?: number }>(url, { delta });
  }

  // CORREGIDO: cambiar de /strips a /grant-strip
  updateStrips(passSerial: string, stripNumber: number): Observable<StripResponse> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/strips`;
    return this.http.post<StripResponse>(url, { stripNumber });
  }

  // NUEVO: resetear strips
  resetStrips(passSerial: string, redeemed: boolean = false): Observable<ResetResponse> {
    const url = `${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/reset-strips`;
    return this.http.post<ResetResponse>(url, { redeemed });
  }
}
