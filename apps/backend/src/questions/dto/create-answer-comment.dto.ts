import { IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAnswerCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;

  @IsOptional()
  @IsIn(['public', 'anonymous'])
  authorVisibility?: 'public' | 'anonymous';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
