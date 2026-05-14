import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class PublishTestEventDto {
  @IsUUID()
  @IsOptional()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  aggregateType!: string;

  @IsUUID()
  aggregateId!: string;

  @IsUUID()
  @IsOptional()
  initiatorUserId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
