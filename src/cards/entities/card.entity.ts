export class card {
  id_pedido?: string;
  id_cliente?: any;
  id_prestador?: any;
  status_pedido: string;

  valor_negociado?: string;
  horario_negociado?: string;
  data_candidatura?: string;
  status?: boolean;
  codigo_confirmacao?: string;
  data_finalizacao?: string;

  categoria: string;
  subcategoria: string;
  valor: string;
  horario_preferencial: string;

  address: {
    cep: string; // CEP do endereço
    street: string; // Rua
    neighborhood: string; // Bairro
    city: string; // Cidade
    state: string; // Estado
    number: string; // Número
    complement?: string; // Complemento (opcional)
  };
}
