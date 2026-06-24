'use client';

import { useEffect, useState } from 'react';
import { acceptFriendRequest, getCommunityMailbox, rejectFriendRequest } from '../../lib/api';
import { CommunityProfileModal } from '../../components/community-profile-modal';
import { SiteShell } from '../../components/site-shell';
import { useAuthUser } from '../../components/role-provider';
import type { CommunityMailboxResponse } from '../../lib/types';

export default function MailboxPage() {
  const { authResolved, authUser } = useAuthUser();
  const [mailbox, setMailbox] = useState<CommunityMailboxResponse>({ notifications: [], friendRequests: [] });
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const incomingPendingRequests = mailbox.friendRequests.filter(
    (request) => request.status === 'pending' && request.targetId === authUser?.id,
  );

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    if (!authUser) {
      window.alert('로그인 후 우편함을 볼 수 있습니다.');
      window.location.replace('/profile');
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setMessage('');
      try {
        const result = await getCommunityMailbox(authUser.id);
        if (!mounted) {
          return;
        }
        setMailbox(result ?? { notifications: [], friendRequests: [] });
      } catch (err) {
        if (!mounted) {
          return;
        }
        setMessage(err instanceof Error ? err.message : '우편함을 불러오지 못했습니다.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [authResolved, authUser]);

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    if (!authUser) {
      return;
    }

    setActioningId(requestId);
    setMessage('');
    try {
      if (action === 'accept') {
        await acceptFriendRequest({ requestId, userId: authUser.id });
      } else {
        await rejectFriendRequest({ requestId, userId: authUser.id });
      }
      const refreshed = await getCommunityMailbox(authUser.id);
      setMailbox(refreshed ?? { notifications: [], friendRequests: [] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '친구요청 처리에 실패했습니다.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <SiteShell title="우편함" description="친구요청과 알림을 한곳에서 확인하고 바로 처리할 수 있습니다.">
      <section className="section-card">
        <div className="section-header">
          <h2 style={{ margin: 0 }}>친구요청</h2>
        </div>

        {loading ? <div className="empty-state">우편함을 불러오는 중입니다...</div> : null}
        {message ? <p className="form-message error">{message}</p> : null}

        {!loading && incomingPendingRequests.length === 0 ? <div className="empty-state">대기 중인 친구요청이 없습니다.</div> : null}

        <div className="stack-list" style={{ marginTop: incomingPendingRequests.length > 0 ? '1rem' : 0 }}>
          {incomingPendingRequests.map((request) => (
            <article key={request.id} className="surface-card" style={{ padding: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
                <CommunityProfileModal
                  userId={request.requesterId}
                  viewerId={authUser?.id}
                  displayName={request.requesterName}
                  avatar={request.requesterAvatar}
                  photoUrl={request.requesterPhotoUrl}
                />
                <span className="card-meta">{new Date(request.createdAt).toLocaleString('ko-KR')}</span>
              </div>
              <p style={{ margin: '0 0 0.8rem' }}>친구요청이 도착했습니다. 수락하면 서로 친구로 등록됩니다.</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={actioningId === request.id}
                  onClick={() => void handleRequestAction(request.id, 'accept')}
                >
                  {actioningId === request.id ? '처리 중...' : '수락'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={actioningId === request.id}
                  onClick={() => void handleRequestAction(request.id, 'reject')}
                >
                  거절
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" style={{ marginTop: '1.25rem' }}>
        <div className="section-header">
          <h2 style={{ margin: 0 }}>알림</h2>
        </div>

        {loading ? null : mailbox.notifications.length === 0 ? <div className="empty-state">새 알림이 없습니다.</div> : null}

        <div className="stack-list" style={{ marginTop: mailbox.notifications.length > 0 ? '1rem' : 0 }}>
          {mailbox.notifications.map((notification) => (
            <article key={notification.id} className="surface-card" style={{ padding: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <strong>{notification.title}</strong>
                  <p style={{ margin: '0.35rem 0 0', color: '#4b5563' }}>{notification.message}</p>
                </div>
                <span className="card-meta">{new Date(notification.createdAt).toLocaleString('ko-KR')}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
