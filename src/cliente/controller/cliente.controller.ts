import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ClienteService } from '../service/cliente.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-client.dto';

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

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.clienteService.getById(id);
  }

  @Patch(':id')
  async updateCliente(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clienteService.update(id, updateClienteDto);
  }
}
