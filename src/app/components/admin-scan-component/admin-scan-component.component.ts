import { Component, ElementRef, OnDestroy, ViewChild, EventEmitter, Output } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { WalletService } from '../../services/wallet/wallet.service';

type Detected = { rawValue: string };

@Component({
  selector: 'app-admin-scan-component',
  imports: [HttpClientModule, CommonModule, FormsModule],
  templateUrl: './admin-scan-component.component.html',
  styleUrl: './admin-scan-component.component.scss'
})
export class AdminScanComponentComponent implements OnDestroy{
  @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;
  @Output() bumpedPoints = new EventEmitter<void>();

  scanning = false;
  cameraReady = 'BarcodeDetector' in window && !!(navigator.mediaDevices?.getUserMedia);
  code = '';
  delta = 10;
  busy = false;
  okMsg = '';
  errMsg = '';
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private detector: any = null;

  constructor(private http: HttpClient, private wallet: WalletService){}

  async toggleScan() {
    if (this.scanning) return this.stopScan();
    this.errMsg = ''; this.okMsg = '';

    try {
      if (!('BarcodeDetector' in window)) throw new Error('No soportado');
      // @ts-ignore
      this.detector = new window.BarcodeDetector({
        formats: ['qr_code', 'pdf417', 'aztec', 'code_128']
      });

      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = this.videoRef?.nativeElement!;
      video.srcObject = this.stream;
      await video.play();

      this.scanning = true;
      const tick = async () => {
        if (!this.scanning) return;
        try {
          const dets: Detected[] = await this.detector.detect(video);
          if (dets?.length) {
            const raw = (dets[0].rawValue || '').trim();
            // Normaliza: si te llega JSON {s:"serial"} acepta ambos
            try {
              const parsed = JSON.parse(raw);
              this.code = parsed?.s || parsed?.serial || raw;
            } catch { this.code = raw; }
            // Auto-detener si ya tenemos código
            this.stopScan();
          return; // importantísimo: sal del loop
          }
        } catch {}
        this.rafId = requestAnimationFrame(tick);
      };
      tick();
    } catch (e:any) {
      this.errMsg = 'No se pudo iniciar la cámara. Usa la entrada manual.';
      this.scanning = false;
      this.stopScan();
    }
  }

  stopScan() {
    this.scanning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    // Limpia el video para que quede “fondo” negro compacto
    const v = this.videoRef?.nativeElement;
    if (v) { v.pause(); (v as any).srcObject = null; }
  }

  canSubmit() { return !!this.code && Number.isFinite(Number(this.delta)); }

  private looksLikeUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  async apply() {
    if (!this.canSubmit()) return;
    this.busy = true; this.okMsg = ''; this.errMsg = '';

    try {
      const code = this.code.trim();
      const delta = Number(this.delta);
      let serial = code;

      if (!this.looksLikeUuid(serial)) {
        throw new Error('El código no parece un serial UUID válido.');
      }

       // usa el servicio sin cambiar su firma
      const res = await firstValueFrom(this.wallet.updatePoints(code, delta));

      // intenta leer points si viene (backend lo manda, pero el tipo no lo declara)
      const newPoints = (res as any)?.points;  // <- lectura laxa, NO cambia el servicio
      const applied   = delta > 0 ? `+${delta}` : `${delta}`;

      this.okMsg = `Listo. Se aplicaron ${applied} puntos.` +
                  (newPoints != null ? ` Nuevo total: ${newPoints}.` : '');
      this.bumpedPoints.emit();
    } catch (e: any) {
      this.errMsg = e?.error?.error || e?.error?.message || e?.message || 'No se pudo actualizar puntos';
    } finally {
      this.busy = false;
    }
  }

  ngOnDestroy() { this.stopScan(); }
}
