import { Component, ElementRef, OnDestroy, ViewChild, EventEmitter, Output } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { WalletService } from '../../services/wallet/wallet.service';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface UserSearchResult {
  serial: string;
  name: string;
  email?: string;
  phone?: string;
  card_type: string;
  points?: number;
  strips_collected?: number;
  strips_required?: number;
  reward_title?: string;
  reward_unlocked?: boolean;
}

@Component({
  selector: 'app-admin-scan-component',
  imports: [HttpClientModule, CommonModule, FormsModule],
  templateUrl: './admin-scan-component.component.html',
  styleUrl: './admin-scan-component.component.scss',
})
export class AdminScanComponentComponent implements OnDestroy {
  @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;
  @Output() bumpedPoints = new EventEmitter<void>();

  scannedSuccessfully = false;
  scanning = false;
  cameraReady = !!(navigator.mediaDevices?.getUserMedia);

  // Búsqueda
  searchQuery = '';
  searchType: 'serial' | 'email' | 'phone' = 'serial';
  searchResults: UserSearchResult[] = [];
  showResults = false;

  // Modal de reset
  showResetModal = false;
  resetAction: 'redeem' | 'reset' | null = null;

  code = '';
  delta = 10;
  busy = false;
  okMsg = false;
  errMsg = false;
  userData: any = null;
  currentPoints = 0;
  newPoints = 0;
  nextStripNumber = 1;

  private stream: MediaStream | null = null;
  private codeReader: BrowserMultiFormatReader | null = null;
  private shouldStopScanning = false;

  constructor(private http: HttpClient, private wallet: WalletService) {}

  async toggleScan() {
    if (this.scanning || this.scannedSuccessfully) return;
    this.errMsg = false;
    this.okMsg = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no soporta cámara');
      }

      this.stopScan();

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

      this.codeReader = new BrowserMultiFormatReader();
      this.shouldStopScanning = false;

      this.codeReader.decodeOnceFromVideoElement(video)
        .then((result: any) => {
          if (this.shouldStopScanning) return;

          if (result && !this.scannedSuccessfully) {
            this.code = result.getText().trim();
            this.searchQuery = this.code;
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
      this.errMsg = true;
      this.scanning = false;
      this.stopScan();
    }
  }

  stopScan() {
    this.scanning = false;
    this.shouldStopScanning = true;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    const video = this.videoRef?.nativeElement;
    if (video) {
      video.pause();
      (video as any).srcObject = null;
    }

    if (this.codeReader) {
      this.codeReader = null;
    }
  }

  async searchUsers() {
    if (!this.searchQuery.trim()) {
      this.errMsg = true;
      return;
    }

    this.busy = true;
    this.errMsg = false;
    this.okMsg = false;
    this.showResults = false;
    this.searchResults = [];

    try {
      const payload: any = {};

      if (this.looksLikeUuid(this.searchQuery)) {
        payload.serial = this.searchQuery.trim();
      } else if (this.searchQuery.includes('@')) {
        payload.email = this.searchQuery.trim();
      } else {
        payload.phone = this.searchQuery.trim();
      }

      const response = await this.http.post<any>(
        `${environment.urlApi}/users/search`,
        payload
      ).toPromise();

      if (response && Array.isArray(response) && response.length > 0) {
        this.searchResults = response;

        if (response.length === 1) {
          this.selectUser(response[0]);
        } else {
          this.showResults = true;
        }
      } else {
        this.errMsg = true;
      }
    } catch (e: any) {
      this.errMsg = true;
    } finally {
      this.busy = false;
    }
  }

  selectUser(user: UserSearchResult) {
    this.code = user.serial;
    this.showResults = false;
    this.getUserData(user.serial);
  }

  canSubmit() {
    if (!this.code) return false;

    if (this.userData?.isStrips) {
      return true;
    }

    return Number.isFinite(Number(this.delta));
  }

  private looksLikeUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  async apply() {
    if (!this.canSubmit()) return;

    // Si es strips y está completo, mostrar modal
    if (this.userData?.isStrips && this.userData?.reward_unlocked) {
      this.showResetModal = true;
      return;
    }

    // Si es strips y NO está completo, otorgar strip
    if (this.userData?.isStrips) {
      await this.grantStrip();
    } else {
      // Es puntos
      await this.applyPoints();
    }
  }

  async grantStrip() {
    if (!this.code || this.busy) return;

    this.busy = true;
    this.errMsg = false;
    this.okMsg = false;

    try {
      const code = this.code.trim();

      if (!this.looksLikeUuid(code)) {
        throw new Error('El código no parece un serial UUID válido.');
      }

      const stripNumber = this.nextStripNumber;
      const res = await firstValueFrom(this.wallet.updateStrips(code, stripNumber));

      if (res.ok) {
        this.okMsg = true;

        // Actualizar datos locales
        this.userData.strips_collected = res.strips_collected;
        this.userData.reward_unlocked = res.isComplete;
        this.calculateNextStrip();

        // Si se completó, mostrar celebración
        if (res.isComplete) {
          setTimeout(() => {
            alert(`🎉 ¡Felicidades! Colección completada: ${res.reward_title}`);
          }, 500);
        }

        // Recargar datos del usuario
        await this.getUserData(code);
      } else {
        this.errMsg = true;
      }

      this.bumpedPoints.emit();

    } catch (e: any) {
      console.error('Error granting strip:', e);

      // Si el error indica que está completo
      if (e.error?.error === 'collection_complete') {
        this.userData.reward_unlocked = true;
        this.userData.strips_collected = e.error.strips_collected;
        this.showResetModal = true;
      } else {
        this.errMsg = true;
      }
    } finally {
      this.busy = false;
      setTimeout(() => {
        this.okMsg = false;
        this.errMsg = false;
      }, 3000);
    }
  }

  async applyPoints() {
    if (!this.code || this.busy) return;

    this.busy = true;
    this.okMsg = false;
    this.errMsg = false;

    try {
      const code = this.code.trim();

      if (!this.looksLikeUuid(code)) {
        throw new Error('El código no parece un serial UUID válido.');
      }

      const delta = Number(this.delta);

      if (delta < 0 && Math.abs(delta) > this.currentPoints) {
        this.errMsg = true;
        return;
      }

      const res = await firstValueFrom(this.wallet.updatePoints(code, delta));

      if (res.ok) {
        this.okMsg = true;
        await this.getUserData(code);
      } else {
        this.errMsg = true;
      }

      this.bumpedPoints.emit();

    } catch (e: any) {
      this.errMsg = true;
    } finally {
      this.busy = false;
      setTimeout(() => {
        this.okMsg = false;
        this.errMsg = false;
      }, 3000);
    }
  }

  confirmResetAction(action: 'redeem' | 'reset' | 'cancel') {
    if (action === 'cancel') {
      this.showResetModal = false;
      this.resetAction = null;
      return;
    }

    this.resetAction = action;
    this.resetStrips(action === 'redeem');
  }

  async resetStrips(redeemed: boolean = false) {
    if (!this.code || this.busy) return;

    this.busy = true;
    this.errMsg = false;
    this.okMsg = false;

    try {
      const res = await firstValueFrom(this.wallet.resetStrips(this.code, redeemed));

      if (res.ok) {
        this.userData.strips_collected = 0;
        this.userData.reward_unlocked = false;
        this.nextStripNumber = 1;

        this.okMsg = true;
        this.showResetModal = false;
        this.resetAction = null;

        await this.getUserData(this.code);
      } else {
        this.errMsg = true;
      }
    } catch (e: any) {
      console.error('Error resetting strips:', e);
      this.errMsg = true;
    } finally {
      this.busy = false;
      setTimeout(() => {
        this.okMsg = false;
        this.errMsg = false;
      }, 3000);
    }
  }

  ngOnDestroy() {
    this.stopScan();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  async getUserData(serial: string) {
    try {
      const response = await this.http.post<any>(
        `${environment.urlApi}/users/getbyserial`,
        { serial }
      ).toPromise();

      if (response) {
        this.userData = response;
        this.currentPoints = response.points || 0;

        if (response.card_type === 'strips') {
          this.userData.isStrips = true;
          this.userData.strips_collected = response.strips_collected || 0;
          this.userData.strips_required = response.strips_required || 10;
          this.userData.reward_title = response.reward_title;
          this.userData.reward_unlocked = response.reward_unlocked || false;

          this.calculateNextStrip();
        } else {
          this.userData.isStrips = false;
          this.newPoints = this.currentPoints + this.delta;
        }
      }
    } catch (error) {
      console.error("Error al obtener los datos del usuario:", error);
      this.errMsg = true;
    }
  }

  private calculateNextStrip() {
    const collected = this.userData.strips_collected || 0;
    const required = this.userData.strips_required || 10;

    this.nextStripNumber = collected + 1;

    if (this.nextStripNumber > required) {
      this.nextStripNumber = required;
    }
  }

  updateNewPoints() {
    if (!isNaN(this.delta)) {
      if (this.delta < 0 && Math.abs(this.delta) > this.currentPoints) {
        this.errMsg = true;
        this.newPoints = this.currentPoints;
      } else {
        this.newPoints = this.currentPoints + this.delta;
        this.errMsg = false;
      }
    }
  }
}
