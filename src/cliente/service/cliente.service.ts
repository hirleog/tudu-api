import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-client.dto';
import { normalizeStrings } from 'src/utils/utils';

@Injectable()
export class ClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async createCliente(createClienteDto: CreateClienteDto) {
    const toLowerCaseDto = normalizeStrings(createClienteDto);
    const hashedPassword = await bcrypt.hash(createClienteDto.password, 10);

    const existingEmail = await this.prisma.cliente.findUnique({
      where: { email: toLowerCaseDto.email },
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
        telefone: toLowerCaseDto.telefone,
        nome: toLowerCaseDto.nome,
        sobrenome: toLowerCaseDto.sobrenome,
        cpf: toLowerCaseDto.cpf,
        data_nascimento: toLowerCaseDto.data_nascimento,
        email: toLowerCaseDto.email,
        password: hashedPassword,
        endereco_estado: toLowerCaseDto.endereco_estado,
        endereco_cidade: toLowerCaseDto.endereco_cidade,
        endereco_bairro: toLowerCaseDto.endereco_bairro,
        endereco_rua: toLowerCaseDto.endereco_rua,
        endereco_numero: toLowerCaseDto.endereco_numero,
      },
    });

    return payload;
  }

  async getById(id: number) {
    return this.prisma.cliente.findUnique({
      where: { id_cliente: id },
    });
  }

  // async update(id: number, dto: UpdateClienteDto) {
  //   return this.prisma.cliente.update({
  //     where: { id_cliente: id },
  //     data: dto,
  //   });
  // }

  async update(id: number, dto: UpdateClienteDto, fotoUrl?: string) {
    const updateData: any = normalizeStrings(dto, ['password']);

    // Se uma fotoUrl foi fornecida, adiciona ao objeto de atualização
    if (fotoUrl !== undefined) {
      updateData.foto = fotoUrl;
    }

    return this.prisma.cliente.update({
      where: { id_cliente: id },
      data: updateData,
    });
  }

  async findAllClientes() {
    return this.prisma.cliente.findMany();
  }
}
