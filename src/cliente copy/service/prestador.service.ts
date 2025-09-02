import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { normalizeStrings } from 'src/utils/utils';

@Injectable()
export class PrestadorService {
  constructor(private readonly prisma: PrismaService) {}

  async createPrestador(createPrestadorDto: CreatePrestadorDto) {
    const toLowerCaseDto = normalizeStrings(createPrestadorDto, ['password']);
    const hashedPassword = await bcrypt.hash(createPrestadorDto.password, 10);

    // Verifica se o email já existe
    const data = Object.fromEntries(
      Object.entries(toLowerCaseDto).filter(
        ([_, value]) => value !== undefined,
      ),
    );

    // Verifica se o email já existe
    const existingEmail = await this.prisma.prestador.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new ConflictException('O email já está em uso.');
    }

    // Verifica se o CPF já existe
    if (data.cpf) {
      const existingCpf = await this.prisma.prestador.findUnique({
        where: { cpf: data.cpf },
      });

      if (existingCpf) {
        throw new ConflictException('O CPF já está em uso.');
      }
    }

    // Cria o registro na tabela Prestador
    const payload = await this.prisma.prestador.create({
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
        especializacao: toLowerCaseDto.especializacao,
        descricao: toLowerCaseDto.descricao,
        avaliacao: toLowerCaseDto.avaliacao,
      },
    });

    return payload;
  }

  async changePassword(id: number, changePasswordDto: ChangePasswordDto) {
    // Verificar se as novas senhas coincidem
    if (
      changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword
    ) {
      throw new BadRequestException('As novas senhas não coincidem');
    }

    // Buscar o prestador
    const prestador = await this.getById(id);
    if (!prestador) {
      throw new NotFoundException('Prestador não encontrado');
    }

    // Verificar a senha atual
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      prestador.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Senha atual incorreta');
    }

    // Criptografar a nova senha
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Atualizar a senha
    return this.prisma.prestador.update({
      where: { id_prestador: id },
      data: { password: hashedPassword },
    });
  }

  async getById(id: number) {
    return this.prisma.prestador.findUnique({
      where: { id_prestador: id },
    });
  }

  async update(id: number, dto: UpdatePrestadorDto, fotoUrl?: string) {
    const updateData: any = normalizeStrings(dto, ['password']);

    // Se uma fotoUrl foi fornecida, adiciona ao objeto de atualização
    if (fotoUrl !== undefined) {
      updateData.foto = fotoUrl;
    }

    return this.prisma.prestador.update({
      where: { id_prestador: id },
      data: updateData,
    });
  }
}
