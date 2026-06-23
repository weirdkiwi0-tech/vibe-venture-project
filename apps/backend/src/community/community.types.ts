export type CommunityRelationship = 'self' | 'friend' | 'pending-outgoing' | 'pending-incoming' | 'none';

export interface CommunityProfile {
  id: string;
  name: string;
  role: 'student' | 'mentor';
  avatar: string;
  photoUrl?: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
  attachments: string[];
  viewCount: number;
  likeCount: number;
  createdAt: Date;
}

export interface CommunityPostSummary {
  id: string;
  title: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  authorVisibility: 'nickname' | 'anonymous';
}

export interface CommunityPostDetail extends CommunityPostSummary {
  content: string;
  attachments: string[];
  isMine: boolean;
}

export interface CommunityPostComment {
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
  likeCount: number;
  isMine: boolean;
  replies: CommunityPostComment[];
}

export interface CommunityFriendItem {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
}

export interface CommunityProfileDetail {
  profile: {
    id: string;
    name: string;
    role: 'student' | 'mentor';
    school: string;
    grade: string;
    bio: string;
    avatar: string;
    photoUrl?: string;
    subjects: string[];
    relationship: 'self' | 'friend' | 'pending-outgoing' | 'pending-incoming' | 'none';
    friendCount: number;
    lastMessagePreview: string;
  };
  recentPosts: Array<{
    id: string;
    authorId: string;
    type: 'chat' | 'problem';
    content: string;
    attachments: string[];
    createdAt: string;
    isMine: boolean;
  }>;
  messages: Array<{
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    createdAt: string;
  }>;
  canChat: boolean;
  pendingFriendRequestId: string | null;
  incomingFriendRequestId: string | null;
}

export interface CommunityMailboxFriendRequest {
  id: string;
  requesterId: string;
  targetId: string;
  requesterName: string;
  requesterAvatar: string;
  requesterPhotoUrl?: string;
  targetName: string;
  targetAvatar: string;
  targetPhotoUrl?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMailboxNotification {
  id: string;
  type: 'friend-request' | 'notice';
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  actorPhotoUrl?: string;
  relatedRequestId?: string;
  readAt: string | null;
  createdAt: string;
}

export interface CommunityMailboxResponse {
  notifications: CommunityMailboxNotification[];
  friendRequests: CommunityMailboxFriendRequest[];
}

export interface CommunityBoardResponse {
  posts: CommunityPostSummary[];
  totalPages: number;
  friends: CommunityFriendItem[];
}

export interface CommunityDirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: Date;
}
