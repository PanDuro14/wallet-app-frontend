import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LinksServicesService } from '../../services/linksServices/links-services.service';

@Component({
  selector: 'app-qr-code-display',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="qr-container">
      <div class="qr-canvas-wrapper">
        <canvas #qrCanvas></canvas>
      </div>

      <div class="qr-actions">
        <button mat-raised-button color="primary" (click)="download()">
          <mat-icon>download</mat-icon>
          Download
        </button>
        <button mat-button (click)="regenerate()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <div class="qr-info" *ngIf="businessName">
        <p>{{ businessName }}</p>
      </div>
    </div>
  `,
  styles: [`
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 20px;
    }

    .qr-canvas-wrapper {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    canvas {
      display: block;
      max-width: 100%;
      height: auto;
    }

    .qr-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .qr-info {
      text-align: center;
      color: #666;
      font-size: 14px;
    }

    .qr-info p {
      margin: 0;
      font-weight: 500;
    }
  `]
})
export class QrCodeDisplayComponent implements OnChanges {
  @ViewChild('qrCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() id: number = 0;
  @Input() url: string = '';
  @Input() businessName: string = '';
  @Input() size: number = 300;

  constructor(private linksService: LinksServicesService) {}

  ngAfterViewInit() {
    if (this.url) {
      this.generate();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['url'] && !changes['url'].firstChange && this.canvasRef) {
      this.generate();
    }
  }

  async generate() {
    if (!this.canvasRef?.nativeElement || !this.url) return;

    try {
      await this.linksService.generateQRToCanvas(
        this.canvasRef.nativeElement,
        this.url,
        this.size
      );
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  }

  async download() {
    if (!this.url) return;

    try {
      const filename = this.businessName
        ? `qr-${this.linksService.cleanFilename(this.businessName)}`
        : 'qr-code';

      await this.linksService.downloadQR(this.url, filename);
    } catch (error) {
      console.error('Error descargando QR:', error);
      alert('Error al descargar el código QR');
    }
  }

  regenerate() {
    this.generate();
  }
}
