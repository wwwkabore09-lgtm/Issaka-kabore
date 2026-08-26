import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password doit contenir au moins 8 caractères' })
  @MaxLength(72) // limite de bcrypt
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;
}
