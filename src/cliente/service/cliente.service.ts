import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClienteService {
  constructor(private readonly prisma: PrismaService) {}

  // async create(createUsuarioDto: CreateUsuarioDto) {
  //   return this.prisma.cliente.create({
  //     data: {
  //       telefone: createUsuarioDto.telefone,
  //       nome: createUsuarioDto.nome,
  //       sobrenome: createUsuarioDto.sobrenome,
  //       cpf: createUsuarioDto.cpf,
  //       data_nascimento: createUsuarioDto.data_nascimento,
  //       email: createUsuarioDto.email,
  //       endereco_estado: createUsuarioDto.endereco_estado,
  //       endereco_cidade: createUsuarioDto.endereco_cidade,
  //       endereco_bairro: createUsuarioDto.endereco_bairro,
  //       endereco_rua: createUsuarioDto.endereco_rua,
  //       endereco_numero: createUsuarioDto.endereco_numero,
  //       password: createUsuarioDto.password, // Added password field
  //     },
  //   });
  // }
  async createCliente(createClienteDto: CreateClienteDto) {
    const hashedPassword = await bcrypt.hash(createClienteDto.password, 10);

    // Verifica se o email já existe
    const existingEmail = await this.prisma.cliente.findUnique({
      where: { email: createClienteDto.email },
    });

    if (existingEmail) {
      throw new Error('O email já está em uso.');
    }

    // Verifica se o CPF já existe
    if (createClienteDto.cpf) {
      const existingCpf = await this.prisma.cliente.findUnique({
        where: { cpf: createClienteDto.cpf },
      });

      if (existingCpf) {
        throw new Error('O CPF já está em usoo.');
      }
    }

    // Cria o registro na tabela Cliente
    const cliente = await this.prisma.cliente.create({
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

    return cliente;
  }

  async findAllClientes() {
    return this.prisma.cliente.findMany();
  }

  async findAll(): Promise<any[]> {
    return await this.prisma.cliente.findMany();

    // Transformar os dados para incluir o endereço como um objeto
    // return cards.map((card) => ({
    //   id_pedido: card.id_pedido.toString(),
    //   id_cliente: card.id_cliente.toString() || null,
    //   id_prestador: card.id_prestador.toString() || null,
    //   status_pedido: card.status_pedido,

    //   categoria: card.categoria,
    //   subcategoria: card.subcategoria,
    //   valor: card.valor,
    //   horario_preferencial: card.horario_preferencial,

    //   address: {
    //     cep: card.cep,
    //     street: card.street,
    //     neighborhood: card.neighborhood,
    //     city: card.city,
    //     state: card.state,
    //     number: card.number,
    //     complement: card.complement || null,
    //   },
    // }));
  }
}
