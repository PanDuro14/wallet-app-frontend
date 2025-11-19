import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Business } from '../business/business.service';
import QRCode from 'qrcode';

@Injectable({
  providedIn: 'root'
})
export class LinksServicesService {
  private base = environment.frontBase || (typeof window !== 'undefined' ? window.location.origin : '');

  buildBussinessLink(b: Pick<Business, 'id' | 'slug'>): string {
    return `${this.base}/registro?bid=${b.id}`;
  }

  // Generar QR en canvas
  async generateQRToCanvas(canvas: HTMLCanvasElement, url: string, size: number = 300): Promise<void> {
    try {
      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });
    } catch (error) {
      console.error('Error generando QR:', error);
      throw error;
    }
  }

  // Generar QR como DataURL
  async generateQRDataURL(url: string, size: number = 500): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H'
      });
    } catch (error) {
      console.error('Error generando QR:', error);
      throw error;
    }
  }

  // Descargar QR directamente
  async downloadQR(url: string, filename: string = 'qr-code'): Promise<void> {
    try {
      const qrDataURL = await this.generateQRDataURL(url);
      const link = document.createElement('a');
      link.download = `${filename}-${Date.now()}.png`;
      link.href = qrDataURL;
      link.click();
    } catch (error) {
      console.error('Error descargando QR:', error);
      throw error;
    }
  }

  // Helper: generar nombre limpio para archivos
  cleanFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}
