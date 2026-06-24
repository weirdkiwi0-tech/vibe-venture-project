export interface HomeVideoItem {
  id: string;
  title: string;
  subject: string;
  url: string;
  durationSeconds: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
}

export interface VideoItem {
  id: string;
  title: string;
  subject: string;
  url: string;
  durationSeconds: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
}

export interface HomeQuestionItem {
  id: string;
  title: string;
  body: string;
  subject: string;
  grade: string;
  attachments: string[];
  visibility: 'anonymous' | 'nickname';
  status: 'open' | 'solved';
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  answerCount: number;
}

export interface HomeFeedResponse {
  feed: {
    videos: HomeVideoItem[];
    questions: HomeQuestionItem[];
  };
  metadata: {
    videoCount: number;
    questionCount: number;
    generatedAt: string;
  };
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

export interface CommunityPostCommentItem {
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
  replies: CommunityPostCommentItem[];
}

export interface CommunityFriendItem {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
}

export interface CommunityBoardResponse {
  posts: CommunityPostSummary[];
  totalPages: number;
  friends: CommunityFriendItem[];
}

// profile-panel.tsx 에서 사용하는 레거시 타입 (프로필 페이지 전용)
export type CommunityRelationship = 'self' | 'friend' | 'pending-outgoing' | 'pending-incoming' | 'none';

export interface CommunityProfileSummary {
  id: string;
  name: string;
  role: 'student' | 'mentor';
  photoUrl?: string;
  school: string;
  grade: string;
  bio: string;
  avatar: string;
  subjects: string[];
  relationship: CommunityRelationship;
  friendCount: number;
  lastMessagePreview: string;
}

export interface CommunityBoardFeedItem {
  id: string;
  authorId: string;
  type: 'chat' | 'problem';
  content: string;
  attachments: string[];
  createdAt: string;
  isMine: boolean;
}

export interface CommunityProfileDetailResponse {
  profile: CommunityProfileSummary;
  recentPosts: CommunityBoardFeedItem[];
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

export interface CommunityMailboxResponse {
  notifications: CommunityMailboxNotification[];
  friendRequests: CommunityMailboxFriendRequest[];
}

export interface QuestionItem {
  id: string;
  authorId: string;
  title: string;
  body: string;
  subject: string;
  grade: string;
  attachments: string[];
  visibility: 'anonymous' | 'nickname';
  status: 'open' | 'solved';
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  answerCount: number;
}

export interface QuestionDetailResponse extends QuestionItem {
  answers: Array<{
    id: string;
    questionId: string;
    type: 'text' | 'video';
    content: string;
    attachments: string[];
    createdAt: string;
  }>;
}

export interface MyAnswerItem {
  id: string;
  authorId: string;
  questionId: string;
  type: 'text' | 'video';
  content: string;
  attachments: string[];
  createdAt: string;
}

export interface QuestionAnswerItem {
  id: string;
  authorId: string;
  questionId: string;
  type: 'text' | 'video';
  content: string;
  attachments: string[];
  createdAt: string;
  likeCount: number;
  comments: QuestionAnswerCommentItem[];
}

export interface QuestionAnswerCommentItem {
  id: string;
  answerId: string;
  authorId: string;
  authorVisibility: 'public' | 'anonymous';
  authorName: string;
  content: string;
  attachments: string[];
  parentCommentId: string | null;
  createdAt: string;
  likeCount: number;
  replies: QuestionAnswerCommentItem[];
}

export interface MyVideoItem {
  id: string;
  title: string;
  subject: string;
  url: string;
  durationSeconds: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
}

export interface MyCommunityPostItem {
  id: string;
  title: string;
  content: string;
  attachments: string[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
}


export interface ReportItem {
  id: string;
  targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
  targetId: string;
  reason: string;
  details: string;
  severity: 'normal' | 'high';
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected' | 'restored';
  createdAt: string;
}

export interface AdminReportBucket {
  id: string;
  targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
  targetId: string;
  title: string;
  href: string;
  reportCount: number;
  highestSeverity: 'normal' | 'high';
  latestReportedAt: string;
}

export interface AdminOverviewResponse {
  cards: Array<{
    key: 'pendingReports' | 'reviewingReports' | 'highRiskReports' | 'auditLogs';
    label: string;
    value: number;
  }>;
  reportBuckets: AdminReportBucket[];
  urgentReports: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
}
export interface VideoCommentItem {
  id: string;
  videoId: string;
  authorId: string;
  authorVisibility: 'nickname' | 'anonymous';
  authorName: string;
  authorAvatar: string;
  authorPhotoUrl?: string;
  content: string;
  createdAt: string;
  likeCount: number;
}
