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
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class PrestadorService {
  constructor(
    private readonly prisma: PrismaService,
    private emailService: EmailService,
    private verificationService: VerificationService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async createPrestador(
    createPrestadorDto: any,
    files: {
      documento_frente?: Express.Multer.File[];
      documento_verso?: Express.Multer.File[];
    },
  ) {
    // 1. Normalização e Hash
    const toLowerCaseDto = normalizeStrings(createPrestadorDto, ['password']);
    const hashedPassword = await bcrypt.hash(createPrestadorDto.password, 10);

    // 2. Validações de Duplicidade
    const existingEmail = await this.prisma.prestador.findUnique({
      where: { email: toLowerCaseDto.email },
    });
    if (existingEmail) throw new ConflictException('O email já está em uso.');

    if (toLowerCaseDto.cpf) {
      const existingCpf = await this.prisma.prestador.findUnique({
        where: { cpf: toLowerCaseDto.cpf },
      });
      if (existingCpf) throw new ConflictException('O CPF já está em uso.');
    }

    // 3. Upload das Imagens para o Cloudinary
    let urlFrente = null;
    let urlVerso = null;

    try {
      if (files.documento_frente?.[0]) {
        const resFrente = await this.cloudinaryService.uploadIdentityDocument(
          files.documento_frente[0].buffer,
          files.documento_frente[0].originalname,
        );
        urlFrente = resFrente.secure_url;
      }

      if (files.documento_verso?.[0]) {
        const resVerso = await this.cloudinaryService.uploadIdentityDocument(
          files.documento_verso[0].buffer,
          files.documento_verso[0].originalname,
        );
        urlVerso = resVerso.secure_url;
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Erro ao fazer upload dos documentos.',
      );
    }

    // 4. Criação no Prisma
    return this.prisma.prestador.create({
      data: {
        nome: toLowerCaseDto.nome,
        sobrenome: toLowerCaseDto.sobrenome,
        email: toLowerCaseDto.email,
        password: hashedPassword,
        telefone: toLowerCaseDto.telefone,
        cpf: toLowerCaseDto.cpf,
        data_nascimento: toLowerCaseDto.data_nascimento,

        // Novos campos do Onboarding
        especialidades_selecionadas: toLowerCaseDto.especialidades_selecionadas,
        documento_frente: urlFrente,
        documento_verso: urlVerso,
        status_verificacao: 'PENDENTE',

        // Endereço (se vier no DTO)
        endereco_estado: toLowerCaseDto.endereco_estado,
        endereco_cidade: toLowerCaseDto.endereco_cidade,
        endereco_bairro: toLowerCaseDto.endereco_bairro,
        endereco_rua: toLowerCaseDto.endereco_rua,
        endereco_numero: toLowerCaseDto.endereco_numero,

        // Default
        avaliacao: toLowerCaseDto.avaliacao,
        numero_servicos_feitos: 0,
      },
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
