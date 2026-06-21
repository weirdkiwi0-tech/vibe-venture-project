import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class EarnRewardDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsInt()
  @Min(1)
  points!: number;
}
