import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QrCodeDisplayComponent } from '../qr-code-display/qr-code-display.component';

export interface QRDialogData {
  url: string;
  businessName: string;
}

@Component({
  selector: 'app-qr-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    QrCodeDisplayComponent
  ],
  template: `
    <div class="qr-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>Código QR - {{ data.businessName }}</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <app-qr-code-display
          [url]="data.url"
          [businessName]="data.businessName"
          [size]="350"
        ></app-qr-code-display>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cerrar</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .qr-dialog {
      min-width: 400px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    mat-dialog-content {
      padding: 20px 24px;
      overflow: visible;
    }

    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `]
})
export class QrDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: QRDialogData,
    private dialogRef: MatDialogRef<QrDialogComponent>
  ) {}
}
