// import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeolocationService {
//   constructor(private httpService: HttpService) {}

//   async getCoordsByCep(cep: string): Promise<any> {
//     const url = `https://nominatim.openstreetmap.org/search?postalcode=${cep}&country=Brazil&format=json`;

//     const headers = {
//       'User-Agent': 'tudu-api/0.0.21',
//     };

//     const response$ = this.httpService.get(url, { headers });
//     const response = await firstValueFrom(response$) as { data: any };
//     return response.data;
//   }
}
