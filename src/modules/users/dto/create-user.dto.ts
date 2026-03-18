import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { UserRole } from '../../../common/types/role.enum';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsInt()
  @Min(0)
  balance?: number;
}
