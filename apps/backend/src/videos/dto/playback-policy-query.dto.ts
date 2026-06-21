import { Type } from 'class-transformer';
import { IsIn, IsNumber, Max, Min } from 'class-validator';

export class PlaybackPolicyQueryDto {
  @IsIn(['guest', 'member'])
  viewerType!: 'guest' | 'member';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  positionPercent!: number;
}
