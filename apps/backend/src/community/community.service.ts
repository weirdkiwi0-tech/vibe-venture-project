import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import type {
  CommunityBoardResponse,
  CommunityDirectMessage,
  CommunityFriendItem,
  CommunityPost,
  CommunityPostComment,
  CommunityPostDetail,
  CommunityPostSummary,
  CommunityProfile,
} from './community.types';

const PAGE_SIZE = 10;

interface FriendRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  updatedAt: Date;
}

interface FriendRequestResponse {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CommunityService {
  private readonly profiles = new Map<string, CommunityProfile>();
  private readonly posts: CommunityPost[] = [];
  private readonly postLikes = new Map<string, Set<string>>();
  private readonly postComments = new Map<string, CommunityPostComment[]>();
  private readonly directMessages: CommunityDirectMessage[] = [];
  private readonly friendships = new Set<string>();
  private readonly friendRequests: FriendRequestRecord[] = [];

  constructor(private readonly authService: AuthService) {}

  async getBoard(currentUserId = 'student-jun', page = 1, query = ''): Promise<CommunityBoardResponse> {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = [...this.posts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((post) =>
        normalizedQuery
          ? post.title.toLowerCase().includes(normalizedQuery) || post.content.toLowerCase().includes(normalizedQuery)
          : true,
      );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const posts: CommunityPostSummary[] = paginated.map((post) => this.mapPostSummary(post));
    const friends: CommunityFriendItem[] = this.getFriendList(currentUserId);

    return { posts, totalPages, friends };
  }

  async createPost(
    input: { title: string; content: string; attachments?: string[] },
    authorId = 'student-jun',
  ): Promise<CommunityPostDetail> {
    this.requireProfile(authorId);

    const post: CommunityPost = {
      id: randomUUID(),
      authorId,
      title: input.title,
      content: input.content,
      attachments: input.attachments ?? [],
      viewCount: 0,
      likeCount: 0,
      createdAt: new Date(),
    };

    this.posts.unshift(post);
    return this.mapPostDetail(post, authorId);
  }

  async getPostDetail(postId: string, currentUserId?: string): Promise<CommunityPostDetail> {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new NotFoundException('post not found');
    }

    if (this.shouldIncreaseViewCount(currentUserId)) {
      post.viewCount += 1;
    }

    return this.mapPostDetail(post, currentUserId ?? 'anonymous-user');
  }

  async getMyPosts(currentUserId = 'student-jun'): Promise<CommunityPostDetail[]> {
    return this.posts
      .filter((post) => post.authorId === currentUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((post) => this.mapPostDetail(post, currentUserId));
  }

  async getPostComments(postId: string, currentUserId?: string): Promise<CommunityPostComment[]> {
    this.requirePost(postId);
    const viewerId = currentUserId ?? 'anonymous-user';
    const comments = this.postComments.get(postId) ?? [];
    return comments.map((comment) => ({ ...comment, isMine: comment.authorId === viewerId }));
  }

  async createPostComment(
    postId: string,
    input: { content: string },
    authorId: string,
  ): Promise<CommunityPostComment> {
    const post = this.requirePost(postId);
    this.requireProfile(authorId);

    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('comment content is required');
    }

    const profile = this.findProfile(authorId);
    const comment: CommunityPostComment = {
      id: randomUUID(),
      postId: post.id,
      authorId,
      authorName: profile?.name ?? '알 수 없음',
      content,
      createdAt: new Date().toISOString(),
      isMine: true,
    };

    const comments = this.postComments.get(postId) ?? [];
    comments.push(comment);
    this.postComments.set(postId, comments);

    return comment;
  }

  async likePost(postId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
    const post = this.posts.find((p) => p.id === postId);
    if (!post) {
      throw new NotFoundException('post not found');
    }

    const likes = this.postLikes.get(postId) ?? new Set<string>();
    const alreadyLiked = likes.has(userId);

    if (alreadyLiked) {
      likes.delete(userId);
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      likes.add(userId);
      post.likeCount += 1;
    }

    this.postLikes.set(postId, likes);
    return { likeCount: post.likeCount, liked: !alreadyLiked };
  }

  async deletePost(postId: string, userId = 'student-jun'): Promise<void> {
    const postIndex = this.posts.findIndex((post) => post.id === postId);
    if (postIndex < 0) {
      throw new NotFoundException('post not found');
    }
    const requester = this.authService.getUserById(userId);
    const isAdmin = requester?.role === 'admin';
    if (this.posts[postIndex].authorId !== userId && !isAdmin) {
      throw new ForbiddenException('only author can delete post');
    }
    this.posts.splice(postIndex, 1);
  }

  async requestFriend(requesterId: string, targetId: string) {
    if (requesterId === targetId) {
      throw new BadRequestException('cannot friend yourself');
    }

    this.requireProfile(requesterId);
    this.requireProfile(targetId);

    if (this.areFriends(requesterId, targetId)) {
      throw new BadRequestException('already friends');
    }

    const existing = this.friendRequests.find(
      (request) =>
        request.status === 'pending' &&
        request.requesterId === requesterId &&
        request.targetId === targetId,
    );

    if (existing) {
      return this.mapFriendRequest(existing);
    }

    const request: FriendRequestRecord = {
      id: randomUUID(),
      requesterId,
      targetId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.friendRequests.push(request);

    return this.mapFriendRequest(request);
  }

  async acceptFriendRequest(requestId: string, currentUserId = 'student-jun') {
    const request = this.friendRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new NotFoundException('friend request not found');
    }

    if (request.targetId !== currentUserId) {
      throw new BadRequestException('only the target can accept');
    }

    request.status = 'accepted';
    request.updatedAt = new Date();
    this.friendships.add(this.friendshipKey(request.requesterId, request.targetId));

    return this.mapFriendRequest(request);
  }

  async sendDirectMessage(
    input: { recipientId: string; content: string },
    senderId = 'student-jun',
  ) {
    this.requireProfile(senderId);
    this.requireProfile(input.recipientId);

    if (!this.areFriends(senderId, input.recipientId)) {
      throw new BadRequestException('direct chat is available for friends only');
    }

    const message: CommunityDirectMessage = {
      id: randomUUID(),
      senderId,
      recipientId: input.recipientId,
      content: input.content,
      createdAt: new Date(),
    };

    this.directMessages.push(message);

    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private getFriendList(currentUserId: string): CommunityFriendItem[] {
    return this.friendRequests
      .filter(
        (request) =>
          request.status === 'accepted' &&
          (request.requesterId === currentUserId || request.targetId === currentUserId),
      )
      .map((request) => {
        const friendId = request.requesterId === currentUserId ? request.targetId : request.requesterId;
        const profile = this.findProfile(friendId);
        if (!profile) return null;
        return { id: profile.id, name: profile.name, avatar: profile.avatar };
      })
      .filter((item): item is CommunityFriendItem => item !== null);
  }

  private mapFriendRequest(request: FriendRequestRecord): FriendRequestResponse {
    return {
      id: request.id,
      requesterId: request.requesterId,
      targetId: request.targetId,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  private mapPostSummary(post: CommunityPost): CommunityPostSummary {
    const profile = this.findProfile(post.authorId);
    return {
      id: post.id,
      title: post.title,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      createdAt: post.createdAt.toISOString(),
      authorId: post.authorId,
      authorName: profile?.name ?? '알 수 없음',
    };
  }

  private mapPostDetail(post: CommunityPost, currentUserId: string): CommunityPostDetail {
    const profile = this.findProfile(post.authorId);
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      attachments: post.attachments,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      createdAt: post.createdAt.toISOString(),
      authorId: post.authorId,
      authorName: profile?.name ?? '알 수 없음',
      isMine: post.authorId === currentUserId,
    };
  }

  private shouldIncreaseViewCount(currentUserId?: string): boolean {
    if (!currentUserId || currentUserId === 'anonymous-user') {
      return false;
    }

    return Boolean(this.authService.getUserById(currentUserId));
  }

  private requirePost(postId: string): CommunityPost {
    const post = this.posts.find((item) => item.id === postId);
    if (!post) {
      throw new NotFoundException('post not found');
    }
    return post;
  }

  private areFriends(userA: string, userB: string) {
    return this.friendships.has(this.friendshipKey(userA, userB));
  }

  private friendshipKey(userA: string, userB: string) {
    return [userA, userB].sort().join('::');
  }

  private findProfile(id: string): CommunityProfile | undefined {
    const existing = this.profiles.get(id);
    if (existing) {
      return existing;
    }

    const user = this.authService.getUserById(id);
    if (!user) {
      return undefined;
    }

    const displayName = user.displayName.trim();
    const avatarSource = displayName || user.email || '사용자';
    const profile: CommunityProfile = {
      id: user.id,
      name: displayName,
      role: user.role === 'admin' ? 'mentor' : 'student',
      avatar: avatarSource.slice(0, 1).toUpperCase(),
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  private requireProfile(id: string): CommunityProfile {
    const profile = this.findProfile(id);
    if (!profile) {
      throw new NotFoundException('profile not found');
    }
    return profile;
  }
}

