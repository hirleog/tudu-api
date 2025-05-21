import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';

@Injectable()
export class PrestadorService {
  constructor(private readonly prisma: PrismaService) {}

  async createPrestador(createPrestadorDto: CreatePrestadorDto) {
    const hashedPassword = await bcrypt.hash(createPrestadorDto.password, 10);

    // Verifica se o email já existe
    const data = Object.fromEntries(
      Object.entries(createPrestadorDto).filter(
        ([_, value]) => value !== undefined,
      ),
    );

    // Verifica se o email já existe
    const existingEmail = await this.prisma.prestador.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new Error('O email já está em uso.');
    }

    // Verifica se o CPF já existe
    if (data.cpf) {
      const existingCpf = await this.prisma.prestador.findUnique({
        where: { cpf: data.cpf },
      });

      if (existingCpf) {
        throw new Error('O CPF já está em uso.');
      }
    }

    // Cria o registro na tabela Prestador
    const payload = await this.prisma.prestador.create({
      data: {
        telefone: createPrestadorDto.telefone,
        nome: createPrestadorDto.nome,
        sobrenome: createPrestadorDto.sobrenome,
        cpf: createPrestadorDto.cpf,
        data_nascimento: createPrestadorDto.data_nascimento,
        email: createPrestadorDto.email,
        password: hashedPassword,
        endereco_estado: createPrestadorDto.endereco_estado,
        endereco_cidade: createPrestadorDto.endereco_cidade,
        endereco_bairro: createPrestadorDto.endereco_bairro,
        endereco_rua: createPrestadorDto.endereco_rua,
        endereco_numero: createPrestadorDto.endereco_numero,
        especializacao: createPrestadorDto.especializacao,
        descricao: createPrestadorDto.descricao,
        avaliacao: createPrestadorDto.avaliacao,
      },
    });

    return payload;
  }

  async getById(id: number) {
    return this.prisma.prestador.findUnique({
      where: { id_prestador: id },
    });
  }

  async update(id: number, dto: UpdatePrestadorDto) {
    return this.prisma.prestador.update({
      where: { id_prestador: id },
      data: dto,
    });
  }
}
