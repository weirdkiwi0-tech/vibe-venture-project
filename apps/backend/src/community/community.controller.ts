import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth';
import {
  CreateCommunityCommentDto,
  CreateCommunityPostDto,
  CreateFriendRequestDto,
  SendDirectMessageDto,
  UpdateCommunityCommentDto,
  UpdateCommunityPostDto,
} from './dto/community.dto';
import { CommunityService } from './community.service';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly authService: AuthService,
  ) {}

  private resolveAuthenticatedUserId(req: Request, headerUserId?: string) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = this.authService.getUserBySessionId(sessionId);
    if (sessionUser) {
      return sessionUser.id;
    }

    if (!headerUserId) {
      return undefined;
    }

    const headerUser = this.authService.getUserById(headerUserId);
    return headerUser?.id;
  }

  @Get()
  async getBoard(
    @Query('page') page?: string,
    @Query('query') query?: string,
    @Headers('x-user-id') currentUserId?: string,
  ) {
    return this.communityService.getBoard(currentUserId, page ? parseInt(page, 10) : 1, query ?? '');
  }

  @Post('posts')
  async createPost(@Body() body: CreateCommunityPostDto, @Headers('x-user-id') authorId?: string) {
    return this.communityService.createPost(
      {
        title: body.title,
        content: body.content,
        attachments: body.attachments,
        authorVisibility: body.authorVisibility,
      },
      authorId,
    );
  }

  @Patch('posts/:id')
  async updatePost(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: UpdateCommunityPostDto,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.resolveAuthenticatedUserId(req, userIdHeader);
    if (!userId) {
      throw new UnauthorizedException('login required to edit post');
    }

    return this.communityService.updatePost(id, { title: body.title, content: body.content }, userId);
  }

  @Get('posts/:id')
  async getPost(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') currentUserId?: string,
  ) {
    const viewerId = this.resolveAuthenticatedUserId(req, currentUserId);
    return this.communityService.getPostDetail(id, viewerId);
  }

  @Get('posts/:id/comments')
  async getPostComments(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') currentUserId?: string,
  ) {
    const viewerId = this.resolveAuthenticatedUserId(req, currentUserId);
    return this.communityService.getPostComments(id, viewerId);
  }

  @Get('profiles/:id')
  async getProfile(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('currentUserId') currentUserId?: string,
    @Headers('x-user-id') currentUserHeader?: string,
  ) {
    const viewerId = this.resolveAuthenticatedUserId(req, currentUserHeader) ?? currentUserId;
    return this.communityService.getProfile(id, viewerId);
  }

  @Get('mailbox')
  async getMailbox(@Req() req: Request, @Headers('x-user-id') currentUserId?: string) {
    const viewerId = this.resolveAuthenticatedUserId(req, currentUserId);
    if (!viewerId) {
      throw new UnauthorizedException('login required to view mailbox');
    }

    return this.communityService.getMailbox(viewerId);
  }

  @Post('posts/:id/comments')
  async createPostComment(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: CreateCommunityCommentDto,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.resolveAuthenticatedUserId(req, userIdHeader);
    if (!userId) {
      throw new UnauthorizedException('login required to comment');
    }

    return this.communityService.createPostComment(
      id,
      { content: body.content, parentCommentId: body.parentCommentId, authorVisibility: body.authorVisibility },
      userId,
    );
  }

  @Patch('posts/:id/comments/:commentId')
  async updatePostComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
    @Body() body: UpdateCommunityCommentDto,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.resolveAuthenticatedUserId(req, userIdHeader);
    if (!userId) {
      throw new UnauthorizedException('login required to edit comment');
    }

    return this.communityService.updatePostComment(id, commentId, { content: body.content }, userId);
  }

  @Post('posts/:id/comments/:commentId/like')
  async likePostComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const userId = this.resolveAuthenticatedUserId(req, userIdHeader);
    if (!userId) {
      throw new UnauthorizedException('login required to like comment');
    }

    return this.communityService.likePostComment(id, commentId, userId);
  }

  @Get('my/posts')
  async getMyPosts(@Headers('x-user-id') currentUserId?: string) {
    return this.communityService.getMyPosts(currentUserId);
  }

  @Post('posts/:id/like')
  async likePost(@Param('id') id: string, @Req() req: Request) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const user = this.authService.getUserBySessionId(sessionId);
    if (!user) {
      throw new UnauthorizedException('login required to like post');
    }

    return this.communityService.likePost(id, user.id);
  }

  @Delete('posts/:id')
  async deletePost(
    @Param('id') id: string,
    @Req() req: Request,
    @Headers('x-user-id') userIdHeader?: string,
  ) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const sessionUser = this.authService.getUserBySessionId(sessionId);
    const requestUserId = sessionUser?.id ?? userIdHeader;
    await this.communityService.deletePost(id, requestUserId);
    return { success: true };
  }

  @Post('friend-requests')
  async createFriendRequest(
    @Body() body: CreateFriendRequestDto,
    @Headers('x-user-id') requesterId?: string,
  ) {
    return this.communityService.requestFriend(requesterId ?? 'student-jun', body.targetId);
  }

  @Post('friend-requests/:id/accept')
  async acceptFriendRequest(@Param('id') id: string, @Headers('x-user-id') currentUserId?: string) {
    return this.communityService.acceptFriendRequest(id, currentUserId);
  }

  @Post('friend-requests/:id/reject')
  async rejectFriendRequest(@Param('id') id: string, @Headers('x-user-id') currentUserId?: string) {
    return this.communityService.rejectFriendRequest(id, currentUserId);
  }

  @Post('messages/direct')
  async sendDirectMessage(
    @Body() body: SendDirectMessageDto,
    @Headers('x-user-id') senderId?: string,
  ) {
    return this.communityService.sendDirectMessage(
      {
        recipientId: body.recipientId,
        content: body.content,
      },
      senderId,
    );
  }
}

