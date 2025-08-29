import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExperienciaDto } from '../dto/create-experiencia.dto';
import { UpdateExperienciaDto } from '../dto/update-experiencia.dto';

@Injectable()
export class ExperienciaService {
  constructor(private prisma: PrismaService) {}

  async create(
    createExperienciaDto: CreateExperienciaDto,
    imagensUrl?: string[],
  ) {
    const experienciaData: any = {
      titulo: createExperienciaDto.titulo,
      descricao: createExperienciaDto.descricao,
      empresa: createExperienciaDto.empresa,
      data_inicio: createExperienciaDto.data_inicio,
      data_fim: createExperienciaDto.data_fim,
      tipo: createExperienciaDto.tipo,
      prestador_id: Number(createExperienciaDto.prestador_id),
    };

    if (imagensUrl && imagensUrl.length > 0) {
      experienciaData.imagens = {
        create: imagensUrl.map((url, index) => ({
          url,
          // ordem: index,
        })),
      };
    }

    const novaExperiencia = await this.prisma.experiencia.create({
      data: experienciaData,
      include: { imagens: true },
    });

    return novaExperiencia;
  }

  async findAllByPrestador(prestadorId: number) {
    return this.prisma.experiencia.findMany({
      where: { prestador_id: prestadorId },
      include: { imagens: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.experiencia.findUnique({
      where: { id },
      include: { imagens: true },
    });
  }

  async update(id: number, updateExperienciaDto: UpdateExperienciaDto) {
    return this.prisma.experiencia.update({
      where: { id },
      data: updateExperienciaDto,
      include: { imagens: true },
    });
  }

  async remove(id: number) {
    return this.prisma.experiencia.delete({
      where: { id },
    });
  }

  // async addImagens(experienciaId: number, imagensUrl: string[]) {
  //   const imagensData = imagensUrl.map((url, index) => ({
  //     url,
  //     nome: `Imagem ${index + 1}`,
  //     ordem: index,
  //     experiencia_id: experienciaId,
  //   }));

  //   return this.prisma.imagemExperiencia.createMany({
  //     data: imagensData,
  //   });
  // }

  async removeImagem(imagemId: number) {
    return this.prisma.imagemExperiencia.delete({
      where: { id: imagemId },
    });
  }
}
