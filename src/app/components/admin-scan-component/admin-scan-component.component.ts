  import { Component, ElementRef, OnDestroy, ViewChild, EventEmitter, Output } from '@angular/core';
  import { HttpClient, HttpClientModule } from '@angular/common/http';
  import { environment } from '../../../environments/environment';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { firstValueFrom, from } from 'rxjs';
  import { WalletService } from '../../services/wallet/wallet.service';
  import { BrowserMultiFormatReader } from '@zxing/browser';

  @Component({
    selector: 'app-admin-scan-component',
    imports: [HttpClientModule, CommonModule, FormsModule],
    templateUrl: './admin-scan-component.component.html',
    styleUrl: './admin-scan-component.component.scss',
  })
  export class AdminScanComponentComponent implements OnDestroy{
    @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;
    @Output() bumpedPoints = new EventEmitter<void>();

    scannedSuccessfully = false;

    scanning = false;
    cameraReady = !!(navigator.mediaDevices?.getUserMedia);
    code = '';
    delta = 10;
    busy = false;
    okMsg = '';
    errMsg = '';
    userData: any = [];
    currentPoints = 0;
    newPoints = 0;
    private stream: MediaStream | null = null;
    private codeReader: BrowserMultiFormatReader | null = null
    private shouldStopScanning = false;

    constructor(private http: HttpClient, private wallet: WalletService){}

    async toggleScan() {
      if (this.scanning || this.scannedSuccessfully) return;
      this.errMsg = ''; this.okMsg = '';

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Este navegador no soporta cámara');
        }

        // Evitar que sigua habiendo un escaneo anterior
        this.stopScan();

        // Stream trasera si se detecta
        const devices = await navigator.mediaDevices.enumerateDevices();
        const backCameras = devices.filter(d =>
          d.kind === 'videoinput' && /back|environment/i.test(d.label)
        );

        const selectedCamera = backCameras[1] || backCameras[0];

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: { exact: selectedCamera.deviceId } }
                      : { facingMode: { ideal: 'environment' },
                      width: { ideal: 1280 }, height: { ideal: 720 }},
          audio: false
        });

        const video = this.videoRef?.nativeElement!;
        video.srcObject = this.stream;
        video.setAttribute('playsinline', 'true');
        (video as any).setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        await video.play();
        this.scanning = true;

        // Inicializa zxing-js
        this.codeReader = new BrowserMultiFormatReader();
        this.shouldStopScanning = false;

        this.codeReader.decodeOnceFromVideoElement(video)
          .then((result: any) => {
            if (this.shouldStopScanning) return;

            if (result && !this.scannedSuccessfully) {
              this.code = result.getText().trim();
              this.getUserData(this.code);
              this.scannedSuccessfully = true;
              this.shouldStopScanning = true;

              this.stopScan();

              setTimeout(() => {
                this.scannedSuccessfully = false;
                this.shouldStopScanning = false;
              }, 3000);
            }
          })
        .catch((error: any) => {
          if (error.name !== 'NotFoundException' && !this.shouldStopScanning) {
            console.error('Error en el escaneo: ', error);
          }
        });
      } catch (e: any) {
        this.errMsg = e?.message || 'No se pudo iniciar la cámara. Verifica permisos y HTTPS.';
        this.scanning = false;
        this.stopScan();
      }
    }

    stopScan() {
      this.scanning = false;  // Marcar que no estamos escaneando
      this.shouldStopScanning = true;
      // Limpiar recursos manualmente
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());  // Detener todas las pistas del stream
        this.stream = null;  // Limpiar el stream
      }

      // Detener el video y limpiar la fuente
      const video = this.videoRef?.nativeElement;
      if (video) {
        video.pause();  // Pausar el video
        (video as any).srcObject = null;  // Limpiar la fuente del video
      }

      // Limpiar el lector de códigos
      if (this.codeReader) {
        this.codeReader = null;  // Limpiar la instancia del lector
      }
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

        if (delta < 0 && Math.abs(delta) > this.currentPoints) {
          this.errMsg = 'Saldo insuficiente. No puedes restar más puntos de los que tienes.';
          return;
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

    ngOnDestroy() {
      this.stopScan();
      if(this.stream){
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
    }

    async getUserData(serial: string) {
      try {
        // Hacer la llamada al backend
        const response = await this.http.post<any>(`${environment.urlApi}/users/getbyserial`, { serial }).toPromise();
        if (response) {
          this.userData = response;
          this.currentPoints = response.points || 0;
          this.newPoints = this.currentPoints + this.delta;
        }
      } catch (error) {
        console.error("Error al obtener los datos del usuario:", error);
        return;  // En caso de error, no hacer nada
      }
    }

    updateNewPoints() {
      // Validamos que delta sea un número y lo sumamos a los puntos actuales
      if (!isNaN(this.delta)) {

        if(this.delta < 0 && Math.abs(this.delta) > this.currentPoints ){
          this.errMsg = 'Saldo insuficiente.'
          this.newPoints = this.currentPoints;
        } else {
          this.newPoints = this.currentPoints + this.delta;
          this.errMsg = '';
        }
      }
    }


  }
