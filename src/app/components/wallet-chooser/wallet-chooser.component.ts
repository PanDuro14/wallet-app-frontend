import { Component, Inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface WalletChooserData{
  appleUrl?: string | null;
  googleUrl?: string | null;
}

@Component({
  selector: 'app-wallet-chooser',
  standalone: true,
  imports: [ CommonModule, MatDialogModule ],
  templateUrl: './wallet-chooser.component.html',
  styleUrl: './wallet-chooser.component.scss'
})
export class WalletChooserComponent {
  @Input() appleUrl: string | null | undefined = null;
  @Input() googleUrl: string | null | undefined = null;
  @Output() selected = new EventEmitter<'apple' | 'google'>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: WalletChooserData,
    private dialogRef: MatDialogRef<WalletChooserComponent>
  ){
    if(data){
      this.appleUrl = data.appleUrl ?? this.appleUrl;
      this.googleUrl = data.googleUrl ?? this.googleUrl;
    }
  }

  choose(target: 'apple' | 'google'): void {
    this.selected.emit(target);
    this.dialogRef.close(target);
  }

  close(): void {
    this.dialogRef.close();
  }

}
