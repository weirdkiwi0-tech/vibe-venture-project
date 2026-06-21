import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsIn(['1', '2', '3'])
  grade!: string;

  @IsOptional()
  @IsIn(['anonymous', 'nickname'])
  visibility?: 'anonymous' | 'nickname';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
