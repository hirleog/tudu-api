import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PrestadorService } from '../service/prestador.service';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';

@Controller('prestadores')
export class PrestadorController {
  constructor(private readonly prestadorService: PrestadorService) {}

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.prestadorService.getById(id);
  }

  @Post()
  async createPrestador(@Body() createPrestadorDto: CreatePrestadorDto) {
    return this.prestadorService.createPrestador(createPrestadorDto);
  }

  @Patch(':id')
  async updatePrestador(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePrestadorDto: UpdatePrestadorDto,
  ) {
    return this.prestadorService.update(id, updatePrestadorDto);
  }
}
