import type {
  AdminReportBucket,
  AdminOverviewResponse,
  CommunityBoardResponse,
  CommunityPostCommentItem,
  CommunityPostDetail,
  CommunityProfileDetailResponse,
  MyAnswerItem,
  MyCommunityPostItem,
  MyVideoItem,
  HomeFeedResponse,
  VideoItem,
  VideoCommentItem,
  QuestionAnswerCommentItem,
  QuestionAnswerItem,
  QuestionItem,
  ReportItem,
} from './types';
import type { UserRole } from './roles';

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function inferAzureBackendUrlFromFrontendHost(hostname: string): string | null {
  if (!(hostname.endsWith('.azurecontainerapps.io') || hostname.endsWith('.azurecontainer.io'))) {
    return null;
  }

  if (hostname.startsWith('frontend.')) {
    return `https://backend.${hostname.slice('frontend.'.length)}`;
  }

  if (hostname.startsWith('frontend-')) {
    return `https://backend-${hostname.slice('frontend-'.length)}`;
  }

  return null;
}

function apiBaseUrl() {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (publicApiUrl) {
    return publicApiUrl;
  }

  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_BASE_URL ??
      process.env.API_BASE_URL ??
      process.env.BACKEND_BASE_URL ??
      'http://backend:3000'
    );
  }

  const inferredAzureBackendUrl = inferAzureBackendUrlFromFrontendHost(window.location.hostname);
  if (inferredAzureBackendUrl) {
    return inferredAzureBackendUrl;
  }

  return DEFAULT_API_BASE_URL;
}

export function getApiBaseUrl() {
  return apiBaseUrl();
}

function withCookieHeader(cookieHeader?: string): Record<string, string> {
  return cookieHeader ? { Cookie: cookieHeader } : {};
}

function withUserIdHeader(userId?: string): Record<string, string> {
  return userId ? { 'x-user-id': userId } : {};
}

function jsonHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(extraHeaders ?? {}),
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const responseText = await response.text();
    let parsedMessage = '';

    try {
      const parsed = JSON.parse(responseText) as { message?: string };
      parsedMessage = parsed.message?.trim() ?? '';
    } catch {
      parsedMessage = '';
    }

    if (parsedMessage) {
      throw new Error(parsedMessage);
    }

    if (responseText.trim()) {
      throw new Error(responseText.trim());
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface AuthMeResponse {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    displayName: string;
    photoUrl?: string;
    role: UserRole;
  };
  ban?: {
    isBanned: boolean;
    bannedUntil: string | null;
    remainingSeconds: number;
    logoutAfterSeconds: number;
  };
}

export async function getAuthMe() {
  return fetchJson<AuthMeResponse>('/auth/me');
}

export async function signUpLocal(input: { email: string; password: string; displayName: string; photoUrl?: string }) {
  return fetchJson<{ success: boolean; user: { id: string; email: string; displayName: string; photoUrl?: string; role: UserRole } }>('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function signInLocal(input: { email: string; password: string }) {
  return fetchJson<{ success: boolean; user: { id: string; email: string; displayName: string; photoUrl?: string; role: UserRole } }>('/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getGoogleAuthUrl() {
  return `${apiBaseUrl()}/auth/google`;
}

export function getLogoutUrl() {
  return `${apiBaseUrl()}/auth/logout`;
}

export async function getHomeFeed(cookieHeader?: string) {
  return fetchJson<HomeFeedResponse>('/home', {
    headers: withCookieHeader(cookieHeader),
  });
}

export async function getQuestions(cookieHeader?: string) {
  return fetchJson<QuestionItem[]>('/questions', {
    headers: withCookieHeader(cookieHeader),
  });
}

export async function getQuestionsAll(
  filters?: { subject?: string; grade?: string; title?: string },
  cookieHeader?: string,
) {
  const params = new URLSearchParams();
  if (filters?.subject) params.append('subject', filters.subject);
  if (filters?.grade) params.append('grade', filters.grade);
  if (filters?.title) params.append('title', filters.title);

  const queryString = params.toString();
  const path = queryString ? `/questions/all?${queryString}` : '/questions/all';
  return fetchJson<QuestionItem[]>(path, {
    headers: withCookieHeader(cookieHeader),
  });
}

export async function getQuestion(id: string, cookieHeader?: string) {
  return fetchJson<QuestionItem>(`/questions/${id}`, {
    headers: withCookieHeader(cookieHeader),
  });
}

export async function getQuestionAnswers(id: string) {
  return fetchJson<QuestionAnswerItem[]>(`/questions/${id}/answers`);
}

export async function getMyQuestions(userId: string) {
  return fetchJson<QuestionItem[]>('/questions/mine', {
    headers: withUserIdHeader(userId),
  });
}

export async function getMyAnswers(userId: string) {
  return fetchJson<MyAnswerItem[]>('/questions/mine/answers', {
    headers: withUserIdHeader(userId),
  });
}

export async function deleteQuestion(id: string, userId: string) {
  return fetchJson<{ success: boolean }>(`/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: withUserIdHeader(userId),
  });
}

export async function deleteAnswer(id: string, userId: string) {
  return fetchJson<{ success: boolean }>(`/questions/answers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: withUserIdHeader(userId),
  });
}

export async function createQuestion(input: {
  title: string;
  body: string;
  subject: string;
  grade: string;
  visibility?: 'anonymous' | 'nickname';
  attachments?: string[];
  userId?: string;
}) {
  return fetchJson<QuestionItem>('/questions', {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      subject: input.subject,
      grade: input.grade,
      visibility: input.visibility,
      attachments: input.attachments ?? [],
    }),
  });
}

export async function createReport(input: {
  targetType: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
  targetId: string;
  reason: string;
  details?: string;
  severity?: 'normal' | 'high';
  userId?: string;
}) {
  return fetchJson<ReportItem>('/reports', {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
      severity: input.severity,
    }),
  });
}

export async function getReports() {
  return fetchJson<ReportItem[]>('/reports');
}

export async function createAnswer(input: {
  questionId: string;
  type: 'text' | 'video';
  content: string;
  attachments?: string[];
  userId?: string;
}) {
  return fetchJson<{
    id: string;
    questionId: string;
    type: 'text' | 'video';
    content: string;
    attachments: string[];
    createdAt: string;
  }>(
    `/questions/${input.questionId}/answers`,
    {
      method: 'POST',
      headers: jsonHeaders(withUserIdHeader(input.userId)),
      body: JSON.stringify({
        type: input.type,
        content: input.content,
        attachments: input.attachments ?? [],
      }),
    },
  );
}

export async function likeAnswer(answerId: string, userId?: string) {
  return fetchJson<{ likeCount: number; liked: boolean }>(`/questions/answers/${encodeURIComponent(answerId)}/like`, {
    method: 'POST',
    headers: withUserIdHeader(userId),
  });
}

export async function createAnswerComment(input: {
  answerId: string;
  content: string;
  attachments?: string[];
  parentCommentId?: string;
  authorVisibility?: 'public' | 'anonymous';
  userId?: string;
}) {
  return fetchJson<QuestionAnswerCommentItem>(`/questions/answers/${encodeURIComponent(input.answerId)}/comments`, {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({
      content: input.content,
      attachments: input.attachments ?? [],
      parentCommentId: input.parentCommentId,
      authorVisibility: input.authorVisibility,
    }),
  });
}

export async function likeAnswerComment(input: { answerId: string; commentId: string; userId?: string }) {
  return fetchJson<{ likeCount: number; liked: boolean }>(
    `/questions/answers/${encodeURIComponent(input.answerId)}/comments/${encodeURIComponent(input.commentId)}/like`,
    {
      method: 'POST',
      headers: withUserIdHeader(input.userId),
    },
  );
}

export async function likeQuestion(questionId: string, userId?: string) {
  return fetchJson<QuestionItem & { liked: boolean }>(`/questions/${encodeURIComponent(questionId)}/like`, {
    method: 'POST',
    headers: {
      ...(userId ? { 'x-user-id': userId } : {}),
    },
  });
}

function buildFallbackReportBuckets(overview: Partial<AdminOverviewResponse>): AdminReportBucket[] {
  const urgentReports = Array.isArray(overview.urgentReports) ? overview.urgentReports : [];
  const grouped = new Map<string, AdminReportBucket>();

  for (const report of urgentReports) {
    const targetType = report.targetType === 'answer'
      ? 'answer'
      : report.targetType === 'video'
        ? 'video'
        : report.targetType === 'comment'
          ? 'comment'
          : report.targetType === 'community-post'
            ? 'community-post'
            : 'question';
    const key = `${targetType}:${report.targetId}`;
    const existing = grouped.get(key);
    const href = targetType === 'question'
      ? `/questions/${report.targetId}`
      : targetType === 'video'
        ? `/videos/${report.targetId}`
        : targetType === 'comment'
          ? '/questions'
          : targetType === 'community-post'
            ? `/community/posts/${report.targetId}`
        : '/questions';
    const highestSeverity = report.severity === 'high' ? 'high' : 'normal';

    if (!existing) {
      grouped.set(key, {
        id: key,
        targetType,
        targetId: report.targetId,
        title: report.reason || `신고 대상 ${report.targetId}`,
        href,
        reportCount: 1,
        highestSeverity,
        latestReportedAt: report.createdAt,
      });
      continue;
    }

    existing.reportCount += 1;
    if (highestSeverity === 'high') {
      existing.highestSeverity = 'high';
    }
    if (new Date(report.createdAt).getTime() > new Date(existing.latestReportedAt).getTime()) {
      existing.latestReportedAt = report.createdAt;
    }
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.highestSeverity !== right.highestSeverity) {
      return left.highestSeverity === 'high' ? -1 : 1;
    }
    if (right.reportCount !== left.reportCount) {
      return right.reportCount - left.reportCount;
    }
    return new Date(right.latestReportedAt).getTime() - new Date(left.latestReportedAt).getTime();
  });
}

function normalizeAdminOverview(overview: Partial<AdminOverviewResponse>): AdminOverviewResponse {
  return {
    cards: Array.isArray(overview.cards) ? overview.cards : [],
    urgentReports: Array.isArray(overview.urgentReports) ? overview.urgentReports : [],
    reportBuckets: Array.isArray(overview.reportBuckets)
      ? overview.reportBuckets
      : buildFallbackReportBuckets(overview),
  };
}

export async function getAdminOverview(role: UserRole, cookieHeader?: string) {
  const overview = await fetchJson<Partial<AdminOverviewResponse>>('/admin/overview', {
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });

  return normalizeAdminOverview(overview);
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: UserRole;
  createdAt: string;
  banned_until?: string | null;
}

export async function getAdminUsers(role: UserRole, cookieHeader?: string) {
  return fetchJson<AdminUser[]>('/admin/users', {
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });
}

export async function deleteAdminUser(userId: string, role: UserRole, cookieHeader?: string) {
  return fetchJson<{ success: boolean }>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });
}

export async function banAdminUser(userId: string, banUntil: string, role: UserRole, cookieHeader?: string) {
  return fetchJson<{ success: boolean }>(`/admin/users/${encodeURIComponent(userId)}/ban`, {
    method: 'PATCH',
    headers: {
      'x-user-role': role,
      'Content-Type': 'application/json',
      ...withCookieHeader(cookieHeader),
    },
    body: JSON.stringify({ banUntil }),
  });
}

export async function unbanAdminUser(userId: string, role: UserRole, cookieHeader?: string) {
  return fetchJson<{ success: boolean }>(`/admin/users/${encodeURIComponent(userId)}/unban`, {
    method: 'PATCH',
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });
}

export async function updateAdminUserRole(userId: string, newRole: 'user' | 'admin', role: UserRole, cookieHeader?: string) {
  return fetchJson<{ success: boolean }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: newRole }),
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });
}

export async function getSlaBreaches(role: UserRole, cookieHeader?: string) {
  return fetchJson<
    Array<{
      id: string;
      learnerId: string;
      question: string;
      createdAt: string;
      firstMentorResponseAt: string | null;
      isSlaBreached: boolean;
    }>
  >('/mentoring/sessions/sla/breaches', {
    headers: {
      'x-user-role': role,
      ...withCookieHeader(cookieHeader),
    },
  });
}

export async function rejectReport(reportId: string, reason: string, role: UserRole, cookieHeader?: string) {
  return fetchJson<{ id: string; status: string }>(`/reports/${encodeURIComponent(reportId)}/reject`, {
    method: 'POST',
    headers: {
      'x-user-role': role,
      'Content-Type': 'application/json',
      ...withCookieHeader(cookieHeader),
    },
    body: JSON.stringify({ reason }),
  });
}

export async function deleteReportTarget(reportId: string, reason: string, role: UserRole, cookieHeader?: string) {
  return fetchJson<{ id: string; status: string }>(`/reports/${encodeURIComponent(reportId)}/delete-target`, {
    method: 'POST',
    headers: {
      'x-user-role': role,
      'Content-Type': 'application/json',
      ...withCookieHeader(cookieHeader),
    },
    body: JSON.stringify({ reason }),
  });
}

export async function getCommunityBoard(currentUserId: string, page = 1, query = '') {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('query', query);
  return fetchJson<CommunityBoardResponse>(`/community?${params.toString()}`, {
    headers: { 'x-user-id': currentUserId },
  });
}

export async function getCommunityProfile(profileId: string, currentUserId: string) {
  return fetchJson<CommunityProfileDetailResponse>(
    `/community/profiles/${encodeURIComponent(profileId)}?currentUserId=${encodeURIComponent(currentUserId)}`,
  );
}

export async function getCommunityPost(postId: string, currentUserId: string) {
  return fetchJson<CommunityPostDetail>(`/community/posts/${encodeURIComponent(postId)}`, {
    headers: { 'x-user-id': currentUserId },
  });
}

export async function createCommunityPost(input: {
  title: string;
  content: string;
  attachments?: string[];
  userId: string;
}) {
  return fetchJson('/community/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
      attachments: input.attachments ?? [],
    }),
  });
}

export async function updateCommunityPost(input: {
  postId: string;
  title: string;
  content: string;
  userId: string;
}) {
  return fetchJson<CommunityPostDetail>(`/community/posts/${encodeURIComponent(input.postId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify({
      title: input.title,
      content: input.content,
    }),
  });
}

export async function getCommunityPostComments(postId: string, userId?: string) {
  return fetchJson<CommunityPostCommentItem[]>(`/community/posts/${encodeURIComponent(postId)}/comments`, {
    headers: withUserIdHeader(userId),
  });
}

export async function createCommunityPostComment(input: {
  postId: string;
  content: string;
  parentCommentId?: string;
  userId?: string;
}) {
  return fetchJson<CommunityPostCommentItem>(`/community/posts/${encodeURIComponent(input.postId)}/comments`, {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({ content: input.content, parentCommentId: input.parentCommentId }),
  });
}

export async function updateCommunityPostComment(input: {
  postId: string;
  commentId: string;
  content: string;
  userId?: string;
}) {
  return fetchJson<CommunityPostCommentItem>(
    `/community/posts/${encodeURIComponent(input.postId)}/comments/${encodeURIComponent(input.commentId)}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(withUserIdHeader(input.userId)),
      body: JSON.stringify({ content: input.content }),
    },
  );
}

export async function likeCommunityPost(postId: string) {
  return fetchJson<{ likeCount: number; liked: boolean }>(`/community/posts/${encodeURIComponent(postId)}/like`, {
    method: 'POST',
  });
}

export async function likeCommunityPostComment(input: { postId: string; commentId: string; userId?: string }) {
  return fetchJson<{ likeCount: number; liked: boolean }>(
    `/community/posts/${encodeURIComponent(input.postId)}/comments/${encodeURIComponent(input.commentId)}/like`,
    {
      method: 'POST',
      headers: withUserIdHeader(input.userId),
    },
  );
}

export async function requestFriend(input: { targetId: string; userId: string }) {
  return fetchJson('/community/friend-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify({ targetId: input.targetId }),
  });
}

export async function acceptFriendRequest(input: { requestId: string; userId: string }) {
  return fetchJson(`/community/friend-requests/${encodeURIComponent(input.requestId)}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
  });
}

export async function sendDirectMessage(input: {
  recipientId: string;
  content: string;
  userId: string;
}) {
  return fetchJson('/community/messages/direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify({
      recipientId: input.recipientId,
      content: input.content,
    }),
  });
}

export async function getMyVideos(userId: string) {
  return fetchJson<MyVideoItem[]>('/videos/mine', {
    headers: {
      'x-user-id': userId,
    },
  });
}

export async function getAllVideos(search = '') {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set('q', search.trim());
  }

  const path = params.toString() ? `/videos?${params.toString()}` : '/videos';
  return fetchJson<VideoItem[]>(path);
}

export async function getFilteredVideos(input: {
  search?: string;
  subject?: string;
  sort?: 'latest' | 'popular';
}) {
  const params = new URLSearchParams();
  if (input.search?.trim()) {
    params.set('q', input.search.trim());
  }
  if (input.subject?.trim() && input.subject !== '전체') {
    params.set('subject', input.subject.trim());
  }
  if (input.sort) {
    params.set('sort', input.sort);
  }

  const path = params.toString() ? `/videos?${params.toString()}` : '/videos';
  return fetchJson<VideoItem[]>(path);
}

export async function getVideoById(videoId: string) {
  return fetchJson<VideoItem>(`/videos/${encodeURIComponent(videoId)}`);
}

export async function getVideoComments(videoId: string) {
  return fetchJson<VideoCommentItem[]>(`/videos/${encodeURIComponent(videoId)}/comments`);
}

export async function createVideoComment(input: {
  videoId: string;
  content: string;
  userId?: string;
}) {
  return fetchJson<VideoCommentItem>(`/videos/${encodeURIComponent(input.videoId)}/comments`, {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({ content: input.content }),
  });
}

export async function likeVideoComment(input: { videoId: string; commentId: string; userId?: string }) {
  return fetchJson<{ likeCount: number; liked: boolean }>(
    `/videos/${encodeURIComponent(input.videoId)}/comments/${encodeURIComponent(input.commentId)}/like`,
    {
      method: 'POST',
      headers: withUserIdHeader(input.userId),
    },
  );
}

export async function createVideo(input: {
  title: string;
  subject?: string;
  url: string;
  durationSeconds: number;
  userId?: string;
}) {
  return fetchJson<VideoItem>('/videos', {
    method: 'POST',
    headers: jsonHeaders(withUserIdHeader(input.userId)),
    body: JSON.stringify({
      title: input.title,
      subject: input.subject,
      url: input.url,
      durationSeconds: input.durationSeconds,
    }),
  });
}

export async function likeVideo(videoId: string, userId?: string) {
  return fetchJson<{ id: string; likeCount: number; viewCount: number; liked: boolean }>(`/videos/${encodeURIComponent(videoId)}/like`, {
    method: 'POST',
    headers: withUserIdHeader(userId),
  });
}

export async function trackVideoView(videoId: string) {
  return fetchJson<{ id: string; viewCount: number; likeCount: number }>(`/videos/${encodeURIComponent(videoId)}/view`, {
    method: 'POST',
  });
}

export async function deleteVideo(id: string, userId: string) {
  return fetchJson<{ success: boolean }>(`/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-user-id': userId,
    },
  });
}

export async function getMyCommunityPosts(userId: string) {
  return fetchJson<MyCommunityPostItem[]>('/community/my/posts', {
    headers: {
      'x-user-id': userId,
    },
  });
}

export async function deleteCommunityPost(id: string, userId: string) {
  return fetchJson<{ success: boolean }>(`/community/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-user-id': userId,
    },
  });
}
