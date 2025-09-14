import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
// services
import { BusinessService } from '../../services/business/business.service';
import { environment } from '../../../environments/environment';
import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';
import { LinksServicesService } from '../../services/linksServices/links-services.service';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';


// fecha
import { DatePipe } from '@angular/common';
import { ɵInternalFormsSharedModule } from "@angular/forms";

// components
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { CreateBusinessComponent } from '../create-business/create-business.component';
import { CreateDesingComponent } from '../create-desing/create-desing.component';

@Component({
  selector: 'app-dashboard',
  imports: [HttpClientModule, CommonModule, BufferToBase64Pipe, ɵInternalFormsSharedModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  standalone: true,
  providers: [DatePipe]
})
export class DashboardComponent {
  public allBusinesess: any[] = [];
  public allCards: any[] = [];
  public allLinks: any[] = [];
  public allUsers: any[] = [];

  public isAdminUser = false;
  private userAdmins = {
    email: 'admin'
  }

  constructor (
    private businessService: BusinessService,
    public links: LinksServicesService,
    private authService: AuthService,
    private http: HttpClient,
    private datePipe: DatePipe,
    private dialog: MatDialog,
    private router: Router
  ){}

  async ngOnInit() {
    console.log('Dashboard');
    await this.cargarInformacion();
  }

  async cargarInformacion(){
    const sessionData = await this.getcurrentSessionData();
    if(sessionData){
      console.log('sessionData: ', sessionData );
    }
    await this.checkAdminUser(sessionData.email);
    await this.getAllCardsByBusiness(sessionData.id);
  }

  // getBusinessInSession
  async getcurrentSessionData(){
    return this.businessService.getBusinessData();
  }

  // obtener todos los negocios
  async getAllBusinesses(): Promise<any> {
    try {
      const response = await this.http.get<any>(`${environment.urlApi}/business`).toPromise();
      if(response){
        this.allBusinesess = response.map((business: any) => {
          return {
            ...business,
            created_atFormat: this.formatData(business.created_at),
            updated_atFormat: this.formatData(business.updated_at)
          };
        });

      } else {
        this.allBusinesess = [];
      }
    } catch (error) {
      console.error('Error al obtener negocios:', error);
      throw error;
    }
  }

  // Obtener un business por el id
  async getOneBusinessById(id: number): Promise<any> {
    try {
      const response = await this.http.get<any>(`${environment.urlApi}/business/${id}`).toPromise();
      if(response){
        this.allBusinesess = response.map((business: any) => {
          return {
            ...business,
            created_atFormat: this.formatData(business.created_at),
            updated_atFormat: this.formatData(business.updated_at)
          }
        });
      }
    } catch (error){
      console.error('Error al obtener el business', error);
      throw error;
    }
  }

  // verificar si es admin
  async checkAdminUser(email: string){
      if (email === this.userAdmins.email){
        await this.getAllBusinesses();
        await this.getAllUsers();
        return this.isAdminUser = true;
      } else {
        const sessionData = await this.getcurrentSessionData();
        if(sessionData){
          await this.getOneBusinessById(sessionData.id);
          await this.getAllUsersByBusiness(sessionData.id);
        }
        return this.isAdminUser = false;
      }
  }


  // Obtener todas las tarjetas de acuerdo al negocio
  async getAllCardsByBusiness(id: number): Promise<any> {
    try {
      const response = await this.http.get<any>(`${environment.urlApi}/cards/getByBusiness/${id}`).toPromise();
      if(response){
        this.allCards = response.map((cards: any) => {
          return {
            ...cards,
            created_atFormat: this.formatData(cards.created_at),
            updated_atFormat: this.formatData(cards.updated_at)
          }
        });
        console.log('All cards:', this.allCards);
      } else {
        this.allCards = [];
      }
    } catch (error){
      console.error('Error al obtener las tarjetas', error);
      throw error;
    }
  }

  async getAllUsers(){
    try {
      const response = await this.http.get<any>(`${environment.urlApi}/users`).toPromise();
      if(response){
        this.allUsers = response.map((users: any) => {
          return {
            ...users,
            created_atFormat: this.formatData(users.created_at),
            updated_atFormat: this.formatData(users.updated_at)
          }
        });
      }
    } catch (error){
      console.error(`Error al obtener a los usuarios`);
      throw error;
    }
  }


  async getAllUsersByBusiness(id: number){
    try {
      const response = await this.http.get<any>(`${environment.urlApi}/users/business/${id}`).toPromise();
      if(response){
        this.allUsers = response.map((users: any) => {
          return {
            ...users,
            created_atFormat: this.formatData(users.created_at),
            updated_atFormat: this.formatData(users.updated_at)
          }
        });
      }
    } catch (error){
      console.error(`Error al obtener a los usuarios del negocio: #${id}`);
      throw error;
    }
  }



  // Opciones para los negocios
  // abrir el modal para crear un negocio
  openCrearBusinessModal(){
    const dialogBusness = this.dialog.open(CreateBusinessComponent, {
      panelClass: 'app-dialog',     // clase para estilizar el contenedor
      backdropClass: 'app-backdrop',// clase para el overlay
      autoFocus: false,
      restoreFocus: false
    });

    dialogBusness.componentInstance.createdBusiness.subscribe((biz: {id:number, name:string, email:string}) => {
      dialogBusness.close();
      const dialogDesing = this.dialog.open(CreateDesingComponent, {
        panelClass: 'app-dialog',
        backdropClass: 'app-backdrop',
        autoFocus: false,
        restoreFocus: false,
        disableClose: true // para evitar que se cancele el proceso y deje huerfano al busines xdd
      });
      dialogDesing.componentInstance.businessId = biz.id;
      queueMicrotask(() => dialogDesing.componentInstance.form?.get('businessId')?.setValue(biz.id));

      // cuando se crea el diseño -> set default
      dialogDesing.componentInstance.createdDesing.subscribe(async ({ designId }) => {
        try {
          await this.http.put(`${environment.urlApi}/business/${biz.id}/design/default`, { card_detail_id: designId}).toPromise();
          dialogDesing.close(true);
          await this.cargarInformacion();
        } catch (error: any){
          // fallback: borra el negocio recién creado (rollback)
          await this.http.delete(`${environment.urlApi}/business/${biz.id}`).toPromise();
          dialogDesing.close(false);
          alert('No se pudo establecer el diseño como predeterminado. Se reviritó la creación del negocio');
          await this.cargarInformacion();
        }
      });

      dialogDesing.afterClosed().subscribe(async (ok) => {
        if(ok === true) return;
        try {
          await this.http.delete(`${environment.urlApi}/business/${biz.id}`).toPromise();
        } catch {}
        await this.cargarInformacion();
      });
    });
  }

  openEditarModal(id: number){

  }

  async viewFullBusiness(id: number){
    await this.router.navigate(['/business', String(id)]);
  }

  async deleteOneItem(id: number){
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: { mensaje: '¿Seguro que quieres eliminar a este negocio?' }
    });

    const confirmed = await ref.afterClosed().toPromise();

    if (confirmed) {
      try {
        const response = await this.http
          .delete(`${environment.urlApi}/business/${id}`)
          .toPromise();

        console.log('Usuario eliminado', response);
        await this.cargarInformacion();
        return response;
      } catch (error) {
        console.error('Error al intentar eliminar al usuario', error);
        throw error;
      }
    } else {
      console.log('Eliminación cancelada');
      return null;
    }
  }


  // Opciones para las tarjetas
  openCreateCardModal(){

  }

  openEditarCardModal(id: number){

  }

  deleteOneCardModal(id: number){

  }

  // Opciones para los usuarios
  openEditarUsuario(id: number){

  }


  async openDeleteUser(id: number) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '360px',
      data: { mensaje: '¿Seguro que quieres eliminar a este usuario?' }
    });

    const confirmed = await ref.afterClosed().toPromise();

    if (confirmed) {
      try {
        const response = await this.http
          .delete(`${environment.urlApi}/users/${id}`)
          .toPromise();

        console.log('Usuario eliminado', response);
        await this.cargarInformacion();
        return response;
      } catch (error) {
        console.error('Error al intentar eliminar al usuario', error);
        throw error;
      }
    } else {
      console.log('Eliminación cancelada');
      return null;
    }
  }


  getLinkById(id: number): string | null {
    const b = this.allBusinesess.find(x => x.id === id);
    return b ? this.links.buildBussinessLink(b) : null;
  }

  async copy(txt: string){
    try {
      await navigator.clipboard.writeText(txt);
      alert('Link copiado');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Link copiado (fallback)');
    }
  }

  // Formatear la fecha
  formatData(fecha: string): string | null {
    return this.datePipe.transform(fecha, 'dd/MM/yyyy');
  }

  logout(){
    this.authService.logout();
  }
}
