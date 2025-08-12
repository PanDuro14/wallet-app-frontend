import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
// services
import { BusinessService } from '../../services/business/business.service';
import { environment } from '../../../environments/environment.prod';
import { BufferToBase64Pipe } from '../../Pipe/BufferToBase64.pipe';

// fecha
import { DatePipe } from '@angular/common';
@Component({
  selector: 'app-dashboard',
  imports: [HttpClientModule, CommonModule, BufferToBase64Pipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  standalone: true,
  providers: [DatePipe]
})
export class DashboardComponent {
  public allBusinesess: any[] = [];
  public allCards: any[] = [];

  public isAdminUser = false;
  private userAdmins = {
    email: 'admin'
  }

  constructor (
    private businessService: BusinessService,
    private http: HttpClient,
    private datePipe: DatePipe,
  ){}

  async ngOnInit() {
    console.log('Dashboard');

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

  // verificar si es admin
  async checkAdminUser(email: string){
      if (email === this.userAdmins.email){
        await this.getAllBusinesses();
        return this.isAdminUser = true;
      } else {
        this.allBusinesess = [];
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

  // Opciones para los negocios
  // abrir el modal para crear un negocio
  openCrearBusinessModal(){

  }

  openEditarModal(id: number){

  }

  deleteOneItem(id: number){

  }


  // Opciones para las tarjetas
  openCreateCardModal(){

  }

  openEditarCardModal(id: number){

  }

  deleteOneCardModal(id: number){

  }


  // Formatear la fecha
  formatData(fecha: string): string | null {
    return this.datePipe.transform(fecha, 'dd/MM/yyyy');
  }

}
