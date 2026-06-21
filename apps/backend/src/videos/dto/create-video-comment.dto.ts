import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateVideoCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
