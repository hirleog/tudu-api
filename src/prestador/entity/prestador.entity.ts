export class Cliente {
  id_cliente: number;
  telefone: string;
  nome: string;
  sobrenome: string;
  cpf?: string;
  data_nascimento?: Date;
  email: string;
  endereco_estado?: string;
  endereco_cidade?: string;
  endereco_bairro?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  data_cadastro: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}
