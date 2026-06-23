import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import type {
  CommunityBoardResponse,
  CommunityDirectMessage,
  CommunityFriendItem,
  CommunityMailboxNotification,
  CommunityMailboxResponse,
  CommunityPost,
  CommunityPostComment,
  CommunityPostDetail,
  CommunityPostSummary,
  CommunityProfileDetail,
  CommunityProfile,
} from './community.types';

const PAGE_SIZE = 10;

interface FriendRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

interface FriendRequestResponse {
  id: string;
  requesterId: string;
  targetId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface CommunityPostCommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  authorVisibility: 'nickname' | 'anonymous';
  content: string;
  parentCommentId: string | null;
  createdAt: string;
}

@Injectable()
export class CommunityService {
  private readonly profiles = new Map<string, CommunityProfile>();
  private readonly posts: CommunityPost[] = [];
  private readonly postLikes = new Map<string, Set<string>>();
  private readonly postComments = new Map<string, CommunityPostCommentRecord[]>();
  private readonly commentLikes = new Map<string, Set<string>>();
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

  async updatePost(
    postId: string,
    input: { title: string; content: string },
    requestUserId: string,
  ): Promise<CommunityPostDetail> {
    const post = this.requirePost(postId);

    if (post.authorId !== requestUserId) {
      throw new ForbiddenException('only author can edit post');
    }

    const title = input.title.trim();
    const content = input.content.trim();
    if (!title || !content) {
      throw new BadRequestException('title and content are required');
    }

    post.title = title;
    post.content = content;

    return this.mapPostDetail(post, requestUserId);
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
    return this.buildCommentTree(this.postComments.get(postId) ?? [], currentUserId ?? 'anonymous-user');
  }

  async getProfile(profileId: string, currentUserId?: string): Promise<CommunityProfileDetail> {
    const profile = this.requireProfile(profileId);
    const viewerId = currentUserId ?? 'anonymous-user';
    const requests = this.friendRequests.filter(
      (request) =>
        request.status === 'pending' &&
        (request.requesterId === profileId || request.targetId === profileId || request.requesterId === viewerId || request.targetId === viewerId),
    );

    const incoming = requests.find((request) => request.targetId === profileId && request.status === 'pending' && request.requesterId === viewerId);
    const outgoing = requests.find((request) => request.requesterId === profileId && request.status === 'pending' && request.targetId === viewerId);

    const recentPosts = this.posts
      .filter((post) => post.authorId === profileId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((post) => ({
        id: post.id,
        authorId: post.authorId,
        type: post.attachments.length > 0 ? 'problem' as const : 'chat' as const,
        content: post.content,
        attachments: post.attachments,
        createdAt: post.createdAt.toISOString(),
        isMine: post.authorId === viewerId,
      }));

    const messages = this.directMessages
      .filter((message) =>
        (message.senderId === profileId && message.recipientId === viewerId) ||
        (message.senderId === viewerId && message.recipientId === profileId),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-20)
      .map((message) => ({
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      }));

    return {
      profile: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        school: this.resolveSchool(profileId),
        grade: this.resolveGrade(profileId),
        bio: this.resolveBio(profileId),
        avatar: profile.avatar,
        photoUrl: profile.photoUrl,
        subjects: this.resolveSubjects(profileId),
        relationship: profileId === viewerId ? 'self' : this.areFriends(profileId, viewerId) ? 'friend' : outgoing ? 'pending-outgoing' : incoming ? 'pending-incoming' : 'none',
        friendCount: this.friendRequests.filter((request) => request.status === 'accepted' && (request.requesterId === profileId || request.targetId === profileId)).length,
        lastMessagePreview: messages.length > 0 ? messages[messages.length - 1].content : '',
      },
      recentPosts,
      messages,
      canChat: this.areFriends(profileId, viewerId),
      pendingFriendRequestId: outgoing?.id ?? null,
      incomingFriendRequestId: incoming?.id ?? null,
    };
  }

  async getMailbox(currentUserId: string): Promise<CommunityMailboxResponse> {
    this.requireProfile(currentUserId);

    const friendRequests = this.friendRequests
      .filter((request) => request.requesterId === currentUserId || request.targetId === currentUserId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((request) => {
        const requester = this.requireProfile(request.requesterId);
        const target = this.requireProfile(request.targetId);
        return {
          id: request.id,
          requesterId: request.requesterId,
          targetId: request.targetId,
          requesterName: requester.name,
          requesterAvatar: requester.avatar,
          requesterPhotoUrl: requester.photoUrl,
          targetName: target.name,
          targetAvatar: target.avatar,
          targetPhotoUrl: target.photoUrl,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
          updatedAt: request.updatedAt.toISOString(),
        };
      });

    const notifications: CommunityMailboxNotification[] = friendRequests.map((request) => ({
      id: `friend-request-${request.id}`,
      type: 'friend-request',
      title: request.status === 'pending' ? '새 친구 요청' : request.status === 'accepted' ? '친구 요청 수락됨' : '친구 요청 처리됨',
      message: request.status === 'pending' ? `${request.requesterName} 님이 친구 요청을 보냈습니다.` : `${request.requesterName} 님의 친구 요청이 ${request.status === 'accepted' ? '수락' : '거절'}되었습니다.`,
      actorId: request.requesterId,
      actorName: request.requesterName,
      actorAvatar: request.requesterAvatar,
      actorPhotoUrl: request.requesterPhotoUrl,
      relatedRequestId: request.id,
      readAt: null,
      createdAt: request.updatedAt,
    }));

    return { notifications, friendRequests };
  }

  async createPostComment(
    postId: string,
    input: { content: string; parentCommentId?: string | null; authorVisibility?: 'nickname' | 'anonymous' },
    authorId: string,
  ): Promise<CommunityPostComment> {
    const post = this.requirePost(postId);
    this.requireProfile(authorId);

    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('comment content is required');
    }

    const comments = this.postComments.get(postId) ?? [];
    if (input.parentCommentId && !comments.some((comment) => comment.id === input.parentCommentId)) {
      throw new NotFoundException('parent comment not found');
    }

    const profile = this.findProfile(authorId);
    const comment: CommunityPostCommentRecord = {
      id: randomUUID(),
      postId: post.id,
      authorId,
      authorName: input.authorVisibility === 'anonymous' ? '익명' : profile?.name ?? '알 수 없음',
      authorAvatar: profile?.avatar ?? 'U',
      authorPhotoUrl: profile?.photoUrl,
      authorVisibility: input.authorVisibility ?? 'nickname',
      content,
      parentCommentId: input.parentCommentId ?? null,
      createdAt: new Date().toISOString(),
    };

    comments.push(comment);
    this.postComments.set(postId, comments);

    return this.toCommentNode(comment, authorId, []);
  }

  async updatePostComment(
    postId: string,
    commentId: string,
    input: { content: string },
    requestUserId: string,
  ): Promise<CommunityPostComment> {
    this.requirePost(postId);

    const comments = this.postComments.get(postId) ?? [];
    const commentIndex = comments.findIndex((comment) => comment.id === commentId);
    if (commentIndex < 0) {
      throw new NotFoundException('comment not found');
    }

    const comment = comments[commentIndex];
    if (comment.authorId !== requestUserId) {
      throw new ForbiddenException('only author can edit comment');
    }

    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('comment content is required');
    }

    const updated: CommunityPostCommentRecord = {
      ...comment,
      content,
    };
    comments[commentIndex] = updated;
    this.postComments.set(postId, comments);

    return this.toCommentNode(updated, requestUserId, []);
  }

  async likePostComment(
    postId: string,
    commentId: string,
    userId: string,
  ): Promise<{ likeCount: number; liked: boolean }> {
    this.requirePost(postId);
    const comments = this.postComments.get(postId) ?? [];
    if (!comments.some((comment) => comment.id === commentId)) {
      throw new NotFoundException('comment not found');
    }

    const likes = this.commentLikes.get(commentId) ?? new Set<string>();
    if (likes.has(userId)) {
      likes.delete(userId);
      this.commentLikes.set(commentId, likes);
      return { likeCount: likes.size, liked: false };
    }

    likes.add(userId);
    this.commentLikes.set(commentId, likes);
    return { likeCount: likes.size, liked: true };
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

  async rejectFriendRequest(requestId: string, currentUserId = 'student-jun') {
    const request = this.friendRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new NotFoundException('friend request not found');
    }

    if (request.targetId !== currentUserId) {
      throw new BadRequestException('only the target can reject');
    }

    request.status = 'rejected';
    request.updatedAt = new Date();
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
      authorAvatar: profile?.avatar ?? 'U',
      authorPhotoUrl: profile?.photoUrl,
      authorVisibility: 'nickname',
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
      authorAvatar: profile?.avatar ?? 'U',
      authorPhotoUrl: profile?.photoUrl,
      authorVisibility: 'nickname',
      isMine: post.authorId === currentUserId,
    };
  }

  private shouldIncreaseViewCount(currentUserId?: string): boolean {
    return true;
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
      photoUrl: user.photoUrl ?? undefined,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  private buildCommentTree(records: CommunityPostCommentRecord[], viewerId: string): CommunityPostComment[] {
    const nodes = new Map<string, CommunityPostComment>();
    const roots: CommunityPostComment[] = [];
    const sorted = [...records].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const record of sorted) {
      nodes.set(record.id, this.toCommentNode(record, viewerId, []));
    }

    for (const record of sorted) {
      const node = nodes.get(record.id);
      if (!node) {
        continue;
      }

      if (record.parentCommentId) {
        const parent = nodes.get(record.parentCommentId);
        if (parent) {
          parent.replies.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots;
  }

  private toCommentNode(
    record: CommunityPostCommentRecord,
    viewerId: string,
    replies: CommunityPostComment[],
  ): CommunityPostComment {
    return {
      id: record.id,
      postId: record.postId,
      authorId: record.authorId,
      authorName: record.authorName,
      authorAvatar: record.authorAvatar,
      authorPhotoUrl: record.authorPhotoUrl,
      authorVisibility: record.authorVisibility,
      content: record.content,
      parentCommentId: record.parentCommentId,
      createdAt: record.createdAt,
      likeCount: this.commentLikes.get(record.id)?.size ?? 0,
      isMine: record.authorId === viewerId,
      replies,
    };
  }

  private resolveSchool(profileId: string) {
    return `${profileId.slice(0, 2).toUpperCase()} 학교`;
  }

  private resolveGrade(profileId: string) {
    return String((profileId.length % 3) + 1);
  }

  private resolveBio(profileId: string) {
    return `${profileId} 님의 프로필입니다.`;
  }

  private resolveSubjects(profileId: string) {
    return profileId.startsWith('mentor') ? ['수학', '과학'] : ['수학', '영어'];
  }

  private requireProfile(id: string): CommunityProfile {
    const profile = this.findProfile(id);
    if (!profile) {
      throw new NotFoundException('profile not found');
    }
    return profile;
  }
}

