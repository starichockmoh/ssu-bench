import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListDlqQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  messageType?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
