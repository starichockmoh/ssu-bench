import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBidDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
