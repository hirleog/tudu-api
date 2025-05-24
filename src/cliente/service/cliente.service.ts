import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-client.dto';

@Injectable()
export class ClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async createCliente(createClienteDto: CreateClienteDto) {
    const hashedPassword = await bcrypt.hash(createClienteDto.password, 10);

    const existingEmail = await this.prisma.cliente.findUnique({
      where: { email: createClienteDto.email },
    });

    if (existingEmail) {
      throw new Error('O email já está em uso.');
    }

    if (createClienteDto.cpf) {
      const existingCpf = await this.prisma.cliente.findUnique({
        where: { cpf: createClienteDto.cpf },
      });

      if (existingCpf) {
        throw new Error('O CPF já está em uso.');
      }
    }

    const payload = await this.prisma.cliente.create({
      data: {
        telefone: createClienteDto.telefone,
        nome: createClienteDto.nome,
        sobrenome: createClienteDto.sobrenome,
        cpf: createClienteDto.cpf,
        data_nascimento: createClienteDto.data_nascimento,
        email: createClienteDto.email,
        password: hashedPassword,
        endereco_estado: createClienteDto.endereco_estado,
        endereco_cidade: createClienteDto.endereco_cidade,
        endereco_bairro: createClienteDto.endereco_bairro,
        endereco_rua: createClienteDto.endereco_rua,
        endereco_numero: createClienteDto.endereco_numero,
      },
    });

    return payload;
  }

  async getById(id: number) {
    return this.prisma.cliente.findUnique({
      where: { id_cliente: id },
    });
  }

  async update(id: number, dto: UpdateClienteDto) {
    return this.prisma.cliente.update({
      where: { id_cliente: id },
      data: dto,
    });
  }

  async findAllClientes() {
    return this.prisma.cliente.findMany();
  }
}
