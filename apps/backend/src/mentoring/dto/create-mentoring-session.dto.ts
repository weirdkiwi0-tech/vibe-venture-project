import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMentoringSessionDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}
