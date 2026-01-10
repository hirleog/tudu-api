import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-client.dto';
import { normalizeStrings } from 'src/utils/utils';
import {
  ChangePasswordDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
} from 'src/prestador/dto/change-password.dto';
import { EmailService } from 'src/email/email.service';
import { VerificationService } from 'src/email/verification.service';

@Injectable()
export class ClienteService {
  private readonly logger = new Logger(ClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private emailService: EmailService,
    private verificationService: VerificationService,
  ) {}

  async createCliente(createClienteDto: CreateClienteDto) {
    const toLowerCaseDto = normalizeStrings(createClienteDto, ['password']);
    const hashedPassword = await bcrypt.hash(createClienteDto.password, 10);

    // 1. Validações de duplicidade
    const existingEmail = await this.prisma.cliente.findUnique({
      where: { email: toLowerCaseDto.email },
    });

    // Alterado de 'new Error' para 'ConflictException' (Retorna 409)
    if (existingEmail) {
      throw new ConflictException('O email já está em uso.');
    }

    if (toLowerCaseDto.cpf) {
      const existingCpf = await this.prisma.cliente.findUnique({
        where: { cpf: toLowerCaseDto.cpf },
      });

      if (existingCpf) {
        throw new ConflictException('O CPF já está em uso.');
      }
    }

    // 2. Criação do Cliente no Banco
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

    // 🚀 AÇÃO: ENVIO DE E-MAIL DE BOAS-VINDAS
    this.emailService
      .sendWelcomeEmail(payload.email, payload.nome)
      .catch((err) => {
        this.logger.error(
          `Erro ao enviar e-mail de boas-vindas para ${payload.email}: ${err.message}`,
        );
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

    const { cpf, ...rest } = dto;

    // Verificar se o CPF já existe para outro cliente
    if (cpf) {
      const clienteComMesmoCpf = await this.prisma.cliente.findFirst({
        where: {
          cpf: cpf,
          id_cliente: { not: id }, // Excluir o próprio cliente da verificação
        },
      });

      if (clienteComMesmoCpf) {
        throw new ConflictException('CPF já cadastrado para outro cliente');
      }
    }

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

  // FLUXO DE REDEFINIÇÃO DE SENHA COM TOKEN DE VERIFICAÇÃO POR EMAIL
  // ✅ NOVO: Solicitar redefinição de senha
  async requestPasswordReset(
    requestPasswordResetDto: RequestPasswordResetDto,
  ): Promise<void> {
    const { email } = requestPasswordResetDto;

    // Verificar se o cliente existe
    const cliente = await this.prisma.cliente.findFirst({
      where: { email },
    });

    if (!cliente) {
      // Por segurança, não revelar que o email não existe
      return;
    }

    // Gerar código de verificação
    const verificationCode =
      this.verificationService.generateVerificationCode(email);

    // Enviar email com o código
    const emailSent = await this.emailService.sendPasswordResetEmail(
      email,
      verificationCode,
    );

    if (!emailSent) {
      throw new InternalServerErrorException(
        'Erro ao enviar email de redefinição',
      );
    }
  }

  // ✅ NOVO: Verificar código de redefinição
  async verifyResetCode(
    verifyResetCodeDto: VerifyResetCodeDto,
  ): Promise<boolean> {
    const { email, code } = verifyResetCodeDto;

    try {
      const isValid = this.verificationService.validateCode(code, email);
      return isValid;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // ✅ NOVO: Redefinir senha com código
  async resetPasswordWithCode(
    changePasswordDto: ChangePasswordDto,
  ): Promise<any> {
    const { email, verificationCode, newPassword, confirmNewPassword } =
      changePasswordDto;

    // Validar se as senhas coincidem
    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('As novas senhas não coincidem');
    }

    // Validar código
    try {
      this.verificationService.validateCode(verificationCode, email);
    } catch (error) {
      throw new BadRequestException(error.message);
    }

    // Buscar o cliente pelo EMAIL (não pelo ID)
    const cliente = await this.prisma.cliente.findFirst({
      where: { email },
    });

    if (!cliente) {
      throw new NotFoundException('cliente não encontrado');
    }

    // Criptografar a nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Marcar código como usado
    this.verificationService.markCodeAsUsed(verificationCode);

    // Atualizar a senha usando o ID do cliente encontrado
    return this.prisma.cliente.update({
      where: { id_cliente: cliente.id_cliente }, // ✅ Usa o ID encontrado
      data: { password: hashedPassword },
    });
  }
}
