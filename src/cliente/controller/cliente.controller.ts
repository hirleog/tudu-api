import { Body, Controller, Get, Post } from '@nestjs/common';
import { ClienteService } from '../service/cliente.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';

@Controller('clientes')
export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  @Post()
  async createCliente(@Body() createClienteDto: CreateClienteDto) {
    return this.clienteService.createCliente(createClienteDto);
  }

  @Get()
  async findAllClientes() {
    return this.clienteService.findAllClientes();
  }
}
