import { Body, Controller, Get, Post } from '@nestjs/common';
import { ClienteService } from '../service/cliente.service';
import { CreateClienteDto } from '../dto/create-client.dto';

@Controller('clientes')
export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  @Post()
  async create(@Body() createClienteDto: CreateClienteDto) {
    return this.clienteService.create(createClienteDto);
  }

  @Get()
  findAll() {
    return this.clienteService.findAll(); // Retorna todos os cards
  }
}
