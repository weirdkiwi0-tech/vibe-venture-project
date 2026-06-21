import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsIn(['question', 'answer', 'video', 'comment', 'community-post'])
  targetType!: 'question' | 'answer' | 'video' | 'comment' | 'community-post';

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsIn(['normal', 'high'])
  severity?: 'normal' | 'high';
}
