export class card {
  id_pedido?: string;
  id_cliente?: string;
  id_prestador?: string;
  status_pedido: string;

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
