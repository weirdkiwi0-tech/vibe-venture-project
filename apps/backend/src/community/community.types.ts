export type CommunityRelationship = 'self' | 'friend' | 'pending-outgoing' | 'pending-incoming' | 'none';

export interface CommunityProfile {
  id: string;
  name: string;
  role: 'student' | 'mentor';
  avatar: string;
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
