import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateMentoringMessageDto {
  @IsIn(['learner', 'mentor'])
  sender!: 'learner' | 'mentor';

  @IsString()
  @IsNotEmpty()
  content!: string;
}
