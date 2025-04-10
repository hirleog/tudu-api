import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClienteDto } from '../dto/create-client.dto';

@Injectable()
export class ClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClienteDto: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: {
        telefone: createClienteDto.telefone,
        nome: createClienteDto.nome,
        sobrenome: createClienteDto.sobrenome,
        cpf: createClienteDto.cpf,
        data_nascimento: createClienteDto.data_nascimento,
        email: createClienteDto.email,
        endereco_estado: createClienteDto.endereco_estado,
        endereco_cidade: createClienteDto.endereco_cidade,
        endereco_bairro: createClienteDto.endereco_bairro,
        endereco_rua: createClienteDto.endereco_rua,
        endereco_numero: createClienteDto.endereco_numero,
        password: createClienteDto.password, // Added password field
      },
    });
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
