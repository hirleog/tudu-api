import { Body, Controller, Get, Post } from '@nestjs/common';
import { PrestadorService } from '../service/prestador.service';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';

@Controller('prestadores')
export class PrestadorController {
  constructor(private readonly prestadorService: PrestadorService) {}

  @Post()
  async createPrestador(@Body() createPrestadorDto: CreatePrestadorDto) {
    return this.prestadorService.createPrestador(createPrestadorDto);
  }

  @Get()
  async findAllPrestadores() {
    return this.prestadorService.findAllPrestadores();
  }
}
