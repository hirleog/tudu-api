import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @Length(10, 15)
  @IsOptional()
  telefone: string;

  @IsString()
  @Length(2, 100)
  nome: string;

  @IsString()
  @Length(2, 100)
  sobrenome: string;

  @IsOptional()
  @IsString()
  @Length(11, 14)
  cpf?: string;

  @IsOptional()
  @IsString()
  data_nascimento?: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 100)
  password: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  endereco_estado?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  endereco_cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  endereco_bairro?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  endereco_rua?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  endereco_numero?: string;
}
