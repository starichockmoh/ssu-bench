import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsInt()
  @Min(1)
  price!: number;
}
