export class CreateExperienciaDto {
  titulo: string;
  descricao?: string;
  empresa?: string;
  data_inicio?: string;
  data_fim?: string;
  tipo?: string;
  prestador_id: number;
}
