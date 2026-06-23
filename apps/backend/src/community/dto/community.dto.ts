import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class CreateFriendRequestDto {
  @IsString()
  @IsNotEmpty()
  targetId!: string;
}

export class UpdateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateCommunityCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  recipientId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateCommunityCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  @IsOptional()
  @IsString()
  authorVisibility?: 'nickname' | 'anonymous';
}
