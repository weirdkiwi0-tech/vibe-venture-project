import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ModerationActionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  adminId?: string;
}