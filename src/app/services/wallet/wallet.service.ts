import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class WalletService {
  constructor(private http: HttpClient) { }

  updatePoints(passSerial: string, delta: number): Observable<{ message?: string }> {
    const url = (`${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/points`);
    return this.http.post<{ message?: string }>(url, { delta });
  }

  updateStrips(passSerial: string, stripNumber: number): Observable<{ message?: string}>{
    const url = (`${environment.urlApi}/wallets/internal/passes/${encodeURIComponent(passSerial)}/strips`);
    return this.http.post<{ message?: string}>(url, { stripNumber });
  }
}
