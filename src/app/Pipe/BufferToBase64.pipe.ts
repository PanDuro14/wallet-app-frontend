import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bufferToBase64'
})
export class BufferToBase64Pipe implements PipeTransform {
  transform(buffer: any, mimeType: string = 'image/png'): string {
    if (!buffer) return '';

    let byteArray: Uint8Array;

    // Si es del tipo { data: [...] }
    if (buffer.data && Array.isArray(buffer.data)) {
      byteArray = new Uint8Array(buffer.data);
    }
    // Si ya es un array de números
    else if (Array.isArray(buffer)) {
      byteArray = new Uint8Array(buffer);
    }
    else {
      console.error('Formato de buffer no soportado', buffer);
      return '';
    }

    let binary = '';
    for (let i = 0; i < byteArray.byteLength; i++) {
      binary += String.fromCharCode(byteArray[i]);
    }

    return `data:${mimeType};base64,` + window.btoa(binary);
  }
}
