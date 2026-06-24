'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createCommunityPost,
  getCommunityBoard,
} from '../lib/api';
import { useAuthUser } from './role-provider';
import { useCommunityPreferences } from '../lib/community-preferences';
import type { CommunityBoardResponse } from '../lib/types';
import { CommunityProfileModal } from './community-profile-modal';
import { AnonymousProfileBadge } from './anonymous-profile-badge';
import { DirectChatModal } from './direct-chat-modal';

interface CommunityBoardProps {
  initialBoard: CommunityBoardResponse;
}

export function CommunityBoard({ initialBoard }: CommunityBoardProps) {
  const { authResolved, authUser } = useAuthUser();
  const { preferences } = useCommunityPreferences();
  const [board, setBoard] = useState(initialBoard);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerState, setComposerState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [composerMessage, setComposerMessage] = useState('');
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string; avatar: string; photoUrl?: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const currentUserId = authUser?.id ?? 'guest-user';

  const refreshBoard = async (p = page, q = query) => {
    const updated = await getCommunityBoard(currentUserId, p, q);
    setBoard(updated);
  };

  const openPost = (postId: string) => {
    const url = `/community/posts/${postId}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = url;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  useEffect(() => {
    if (!authResolved) return;
    void refreshBoard(page, query);
  }, [authResolved, currentUserId, page, query]);

  return (
    <div className="community-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', alignItems: 'start' }}>

      {/* ───── 왼쪽: 게시글 목록 ───── */}
      <section className="section-card community-main">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>게시글</h2>
          <button
            type="button"
            className="primary-button"
            onClick={() => setComposerOpen(true)}
            disabled={!authUser}
          >
            + 글쓰기
          </button>
        </div>

        {/* 검색창 */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="게시글 제목이나 관련 텍스트 입력"
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button type="submit" className="primary-button" style={{ padding: '0.5rem 1rem' }}>
            검색
          </button>
        </form>

        {/* 게시글 목록 */}
        <div className="stack-list">
          {board.posts.length === 0 ? (
            <div className="empty-state">게시글이 없습니다. 첫 번째 게시글을 작성해 보세요!</div>
          ) : (
            board.posts.map((post) => (
              <article
                key={post.id}
                className="surface-card"
                style={{ cursor: 'pointer', padding: '0.75rem 1rem' }}
                onClick={() => openPost(post.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {post.authorVisibility === 'anonymous' ? (
                    <AnonymousProfileBadge ariaLabel="익명 작성자" />
                  ) : (
                    <CommunityProfileModal
                      userId={post.authorId}
                      viewerId={currentUserId}
                      displayName={post.authorName}
                      avatar={post.authorAvatar}
                      photoUrl={post.authorPhotoUrl}
                    />
                  )}
                  <span style={{ fontSize: '0.78rem', color: '#888', whiteSpace: 'nowrap', marginTop: '0.25rem' }}>
                    조회 {post.viewCount} · 좋아요 {post.likeCount} · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <strong style={{ fontSize: '0.95rem' }}>{post.title}</strong>
              </article>
            ))
          )}
        </div>

        {/* 페이지네이션 */}
        {board.totalPages > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {Array.from({ length: board.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  border: '1px solid #ccc',
                  background: p === page ? '#3b82f6' : '#fff',
                  color: p === page ? '#fff' : '#333',
                  fontWeight: p === page ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ───── 오른쪽: 친구 목록 ───── */}
      <aside className="section-card community-side" style={{ position: 'sticky', top: '1rem' }}>
        <div className="section-header">
          <h2 style={{ margin: 0, marginBottom: '0.75rem' }}>친구 목록</h2>
        </div>

        {board.friends.length === 0 ? (
          <div className="empty-state" style={{ fontSize: '0.85rem' }}>친구가 없습니다.</div>
        ) : (
          <div className="stack-list">
            {board.friends.map((friend) => (
              <button
                key={friend.id}
                type="button"
                onClick={() => {
                  setChatTarget(friend);
                  setChatOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: chatTarget?.id === friend.id ? '#eff6ff' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{friend.avatar}</span>
                <strong style={{ fontSize: '0.9rem' }}>{friend.name}</strong>
              </button>
            ))}
          </div>
        )}
      </aside>

      <DirectChatModal
        open={chatOpen}
        viewerId={currentUserId}
        target={chatTarget}
        onClose={() => setChatOpen(false)}
      />

      {/* ───── 글쓰기 모달 ───── */}
      {composerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setComposerOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '12px', padding: '2rem', maxWidth: '500px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1rem' }}>게시글 작성</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!authUser) return;
                const title = titleRef.current?.value ?? '';
                const content = contentRef.current?.value ?? '';
                if (!title || !content) return;
                setComposerState('loading');
                try {
                  await createCommunityPost({
                    title,
                    content,
                    authorVisibility: preferences.communityAuthorVisibility,
                    userId: authUser.id,
                  });
                  await refreshBoard(1, '');
                  setPage(1);
                  setQuery('');
                  setComposerOpen(false);
                  setComposerState('idle');
                  setComposerMessage('');
                } catch {
                  setComposerState('error');
                  setComposerMessage('게시글 등록에 실패했습니다.');
                }
              }}
              className="form-grid"
            >
              <label>
                제목 <span style={{ color: 'red' }}>*</span>
                <input ref={titleRef} type="text" name="title" required placeholder="게시글 제목을 입력하세요" />
              </label>
              <label>
                내용 <span style={{ color: 'red' }}>*</span>
                <textarea ref={contentRef} name="content" rows={5} required placeholder="내용을 입력하세요" />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="primary-button" disabled={composerState === 'loading'}>
                  {composerState === 'loading' ? '등록 중...' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: 'none', cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
              {composerMessage && <p style={{ color: 'red', fontSize: '0.85rem' }}>{composerMessage}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
