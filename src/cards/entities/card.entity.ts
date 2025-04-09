export class card {
  client_id?: string;
  categoria: string;
  subcategoria: string;
  valor: string;
  horario_preferencial: string;
  
  cep: string; // CEP do endereço
  street: string; // Rua
  neighborhood: string; // Bairro
  city: string; // Cidade
  state: string; // Estado
  number: string; // Número
  complement?: string; // Complemento (opcional)
}
