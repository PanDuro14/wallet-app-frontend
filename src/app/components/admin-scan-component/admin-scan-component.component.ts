// admin-scan-component.component.ts
// ✅ VERSIÓN HÍBRIDA MEJORADA: Máxima compatibilidad con PWA y Apple Wallet

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
            const scannedCode = result.getText().trim();
            console.log('📷 Código escaneado:', scannedCode);

            // ✅ Procesar código escaneado (puede ser UUID, URL, o serial de Apple)
            this.processScannedCode(scannedCode);

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

  /**
   * ✅ VERSIÓN HÍBRIDA: Procesa CUALQUIER formato de código
   * Soporta:
   * - UUID directo: "550e8400-e29b-41d4-a716-446655440000"
   * - URL completa: "https://loyalty.windoe.mx/wallet/550e8400-..."
   * - URL corta: "loyalty.windoe.mx/wallet/550e8400-..."
   * - Apple Pass: "pass.com.empresa.card.12345"
   * - Cualquier otro formato custom
   */
  private processScannedCode(scannedCode: string) {
    console.log('🔍 Procesando código escaneado...');
    console.log('📝 Valor recibido:', scannedCode);
    console.log('📏 Longitud:', scannedCode.length);
    console.log('🔤 Tipo:', typeof scannedCode);

    // 1️⃣ Verificar si es un UUID directo (caso más común para CODE128)
    if (this.looksLikeUuid(scannedCode)) {
      console.log('🎫 ✅ Detectado: UUID directo de PWA Card');
      this.code = scannedCode;
      this.searchQuery = scannedCode;
      this.getUserData(scannedCode);
      return;
    }

    // 2️⃣ Verificar si es una URL (puede ser QR de PWA)
    if (scannedCode.includes('/wallet/') || scannedCode.includes('wallet/')) {
      console.log('🌐 Detectado: Posible URL de PWA Card');
      const uuid = this.extractUuidFromUrl(scannedCode);
      if (uuid) {
        console.log('✅ UUID extraído de URL:', uuid);
        this.code = uuid;
        this.searchQuery = uuid;
        this.getUserData(uuid);
        return;
      } else {
        console.warn('⚠️ URL detectada pero no se pudo extraer UUID');
      }
    }

    // 3️⃣ Verificar si contiene un UUID en alguna parte (regex agresivo)
    const uuidMatch = scannedCode.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
    if (uuidMatch && uuidMatch[1]) {
      console.log('🔍 ✅ UUID encontrado dentro del texto:', uuidMatch[1]);
      this.code = uuidMatch[1];
      this.searchQuery = uuidMatch[1];
      this.getUserData(uuidMatch[1]);
      return;
    }

    // 4️⃣ Si no es nada de lo anterior, asumir que es Apple Wallet u otro formato
    console.log('🍎 Detectado: Apple Wallet Pass o formato legacy');
    this.code = scannedCode;
    this.searchQuery = scannedCode;
    this.getUserData(scannedCode);
  }

  /**
   * ✅ VERSIÓN MEJORADA: Extrae UUID de URLs con múltiples estrategias
   * Implementa 4 estrategias de extracción para máxima compatibilidad
   */
  private extractUuidFromUrl(url: string): string | null {
    try {
      console.log('🔗 Intentando extraer UUID de:', url);

      // Estrategia 1: Regex directo (más rápido y preciso)
      const regexMatch = url.match(/\/wallet\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
      if (regexMatch && regexMatch[1]) {
        console.log('✅ UUID extraído con regex:', regexMatch[1]);
        return regexMatch[1];
      }

      // Estrategia 2: Parsear como URL válida
      try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(s => s);

        for (const segment of pathSegments) {
          const cleaned = segment.split('?')[0].split('#')[0];
          if (this.looksLikeUuid(cleaned)) {
            console.log('✅ UUID encontrado en pathname:', cleaned);
            return cleaned;
          }
        }
      } catch (e) {
        console.log('⚠️ No es una URL válida, intentando con split manual...');
      }

      // Estrategia 3: Split manual sin parsear (para URLs sin protocolo)
      const segments = url
        .replace(/^https?:\/\//, '') // Remover protocolo si existe
        .replace(/^\/\//, '')         // Remover // si existe
        .split('/')
        .filter(s => s);

      for (const segment of segments) {
        const cleaned = segment.split('?')[0].split('#')[0];
        if (this.looksLikeUuid(cleaned)) {
          console.log('✅ UUID encontrado en segmento:', cleaned);
          return cleaned;
        }
      }

      // Estrategia 4: Buscar UUID en cualquier parte del string (última opción)
      const globalMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
      if (globalMatch && globalMatch[1]) {
        console.log('✅ UUID encontrado globalmente:', globalMatch[1]);
        return globalMatch[1];
      }

      console.warn('❌ No se pudo extraer UUID de:', url);
      return null;

    } catch (error) {
      console.error('❌ Error crítico extrayendo UUID:', error);
      return null;
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

  private looksLikeUuid(v: string): boolean {
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
      const stripNumber = this.nextStripNumber;
      const walletType = this.userData?.walletType; // Puede ser undefined

      console.log('🎯 Otorgando strip:', stripNumber, 'a serial:', code);
      if (walletType) {
        console.log('📱 Tipo de wallet (explícito):', walletType);
      } else {
        console.log('📱 Tipo de wallet: auto-detección activada');
      }

      // ✅ Usar método auto que detecta el tipo automáticamente
      // Si walletType es undefined, el service intentará Apple primero, luego PWA
      const res = await firstValueFrom(
        this.wallet.updateStripsAuto(code, stripNumber, walletType)
      );

      console.log('📦 Respuesta del servidor (completa):', res);
      console.log('📦 Tipo de respuesta:', typeof res);
      console.log('📦 Keys de respuesta:', Object.keys(res));

      // ✅ Verificar éxito de manera más flexible
      const isSuccess = res && (
        res.ok === true ||
        res.ok === 1 ||
        typeof res.strips_collected === 'number'
      );

      if (isSuccess) {
        console.log('✅ Strip otorgado exitosamente');
        this.okMsg = true;

        // Actualizar datos locales con manejo seguro
        if (typeof res.strips_collected === 'number') {
          this.userData.strips_collected = res.strips_collected;
        }

        if (typeof res.isComplete === 'boolean') {
          this.userData.reward_unlocked = res.isComplete;
        }

        if (res.reward_title) {
          this.userData.reward_title = res.reward_title;
        }

        this.calculateNextStrip();

        // Si se completó, mostrar celebración
        if (res.isComplete === true) {
          setTimeout(() => {
            alert(`🎉 ¡Felicidades! Colección completada: ${res.reward_title || this.userData.reward_title}`);
          }, 500);
        }

        // Recargar datos del usuario
        await this.getUserData(code);
        this.bumpedPoints.emit();
      } else {
        console.warn('⚠️ Respuesta inesperada del servidor:', res);
        this.errMsg = true;
      }

    } catch (e: any) {
      console.error('❌ Error granting strip:', e);
      console.error('❌ Error message:', e?.message);
      console.error('❌ Error error:', e?.error);
      console.error('❌ Error status:', e?.status);

      // Si el error indica que está completo
      if (e.error?.error === 'collection_complete' ||
          e.error?.message?.includes('completa') ||
          e.status === 400) {

        console.log('⚠️ Colección ya completa, mostrando modal de reset');

        if (typeof e.error?.strips_collected === 'number') {
          this.userData.strips_collected = e.error.strips_collected;
        }
        this.userData.reward_unlocked = true;
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
      const delta = Number(this.delta);
      const walletType = this.userData?.walletType; // Puede ser undefined

      if (delta < 0 && Math.abs(delta) > this.currentPoints) {
        this.errMsg = true;
        return;
      }

      console.log('⭐ Actualizando puntos. Delta:', delta, 'Serial:', code);
      if (walletType) {
        console.log('📱 Tipo de wallet (explícito):', walletType);
      } else {
        console.log('📱 Tipo de wallet: auto-detección activada');
      }

      // ✅ Usar método auto (intentará Apple primero si walletType es undefined)
      const res = await firstValueFrom(
        this.wallet.updatePointsAuto(code, delta, walletType)
      );

      console.log('📦 Respuesta del servidor:', res);

      // ✅ Verificar éxito
      const isSuccess = res && (
        res.ok === true ||
        res.ok === 1 ||
        typeof res.points === 'number'
      );

      if (isSuccess) {
        this.okMsg = true;
        await this.getUserData(code);
        this.bumpedPoints.emit();
      } else {
        console.warn('⚠️ Respuesta sin ok o points:', res);
        this.errMsg = true;
      }

    } catch (e: any) {
      console.error('❌ Error applying points:', e);
      console.error('Error details:', e.error);
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
      const code = this.code.trim();
      const walletType = this.userData?.walletType; // Puede ser undefined

      console.log('🔄 Reseteando strips. Canjeado:', redeemed, 'Serial:', code);
      if (walletType) {
        console.log('📱 Tipo de wallet (explícito):', walletType);
      } else {
        console.log('📱 Tipo de wallet: auto-detección activada');
      }

      // ✅ Usar método auto (intentará Apple primero si walletType es undefined)
      const res = await firstValueFrom(
        this.wallet.resetStripsAuto(code, redeemed, walletType)
      );

      console.log('📦 Respuesta del servidor:', res);

      // ✅ Verificar éxito
      const isSuccess = res && (res.ok === true || res.ok === 1);

      if (isSuccess) {
        this.userData.strips_collected = 0;
        this.userData.reward_unlocked = false;
        this.nextStripNumber = 1;
        this.okMsg = true;
        this.showResetModal = false;
        this.resetAction = null;

        await this.getUserData(code);
      } else {
        console.warn('⚠️ Respuesta sin ok:', res);
        this.errMsg = true;
      }

    } catch (e: any) {
      console.error('❌ Error resetting strips:', e);
      console.error('Error details:', e.error);
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
      console.log(`🔑 Obteniendo datos del usuario con serial: ${serial}`);

      const response = await this.http.post<any>(
        `${environment.urlApi}/users/getbyserial`,
        { serial }
      ).toPromise();

      if (response) {
        this.userData = response;
        this.currentPoints = response.points || 0;

        // ✅ Guardar el tipo de wallet si el backend lo proporciona
        if (response.wallet_type) {
          this.userData.walletType = response.wallet_type; // 'pwa' o 'apple'
          console.log(`✅ Tipo de wallet desde backend: ${response.wallet_type}`);
        } else {
          // ⚠️ Sin wallet_type desde el backend - el service usará fallback
          this.userData.walletType = undefined;
          console.log(`⚠️ Backend no envió wallet_type - usando auto-detección`);
        }

        if (response.card_type === 'strips') {
          this.userData.isStrips = true;
          this.userData.strips_collected = response.strips_collected || 0;
          this.userData.strips_required = response.strips_required || 10;
          this.userData.reward_title = response.reward_title;
          this.userData.reward_unlocked = response.reward_unlocked || false;

          this.calculateNextStrip();

          console.log(`🎫 Tarjeta de STRIPS: ${this.userData.strips_collected}/${this.userData.strips_required}`);
        } else {
          this.userData.isStrips = false;
          this.newPoints = this.currentPoints + this.delta;

          console.log(`⭐ Tarjeta de PUNTOS: ${this.currentPoints} pts`);
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
