import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePrestadorDto } from '../dto/create-prestador.dto';
import { UpdatePrestadorDto } from '../dto/update-prestador.dto';
import {
  ChangePasswordDto,
  RequestPasswordResetDto,
  VerifyResetCodeDto,
} from '../dto/change-password.dto';
import { normalizeStrings } from 'src/utils/utils';
import { EmailService } from 'src/email/email.service';
import { VerificationService } from 'src/email/verification.service';

@Injectable()
export class PrestadorService {
  constructor(
    private readonly prisma: PrismaService,
    private emailService: EmailService,
    private verificationService: VerificationService,
  ) {}

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

  // FLUXO DE REDEFINIÇÃO DE SENHA COM TOKEN DE VERIFICAÇÃO POR EMAIL
  // ✅ NOVO: Solicitar redefinição de senha
  async requestPasswordReset(
    requestPasswordResetDto: RequestPasswordResetDto,
  ): Promise<void> {
    const { email } = requestPasswordResetDto;

    // Verificar se o prestador existe
    const prestador = await this.prisma.prestador.findFirst({
      where: { email },
    });

    if (!prestador) {
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

    // Buscar o prestador pelo EMAIL (não pelo ID)
    const prestador = await this.prisma.prestador.findFirst({
      where: { email },
    });

    if (!prestador) {
      throw new NotFoundException('Prestador não encontrado');
    }

    // Criptografar a nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Marcar código como usado
    this.verificationService.markCodeAsUsed(verificationCode);

    // Atualizar a senha usando o ID do prestador encontrado
    return this.prisma.prestador.update({
      where: { id_prestador: prestador.id_prestador }, // ✅ Usa o ID encontrado
      data: { password: hashedPassword },
    });
  }
}
