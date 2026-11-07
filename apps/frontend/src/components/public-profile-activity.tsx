'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { getPublicProfileActivity } from '../lib/api';
import type { PublicProfileActivity as ProfileActivity } from '../lib/types';
import { ContentMetric } from './content-metric';

interface PublicProfileActivityProps {
  profileId: string;
  viewerId: string;
}

const ACTIVITY_TABS = [
  { key: 'posts', label: '커뮤니티 글', empty: '공개한 커뮤니티 글이 없습니다.' },
  { key: 'questions', label: '질문', empty: '공개한 질문이 없습니다.' },
  { key: 'videos', label: '영상', empty: '올린 영상이 없습니다.' },
] as const;

export function PublicProfileActivity({ profileId, viewerId }: PublicProfileActivityProps) {
  const id = useId();
  const [activeTab, setActiveTab] = useState<keyof ProfileActivity>('posts');
  const [activity, setActivity] = useState<ProfileActivity | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setActivity(null);
    setError('');

    async function load() {
      try {
        const result = await getPublicProfileActivity(profileId, viewerId);
        if (mounted) setActivity(result);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : '활동 내역을 불러오지 못했습니다.');
      }
    }

    void load();
    return () => { mounted = false; };
  }, [profileId, viewerId, attempt]);

  const selectedTab = ACTIVITY_TABS.find((tab) => tab.key === activeTab)!;

  return (
    <section className="stack-list" aria-label="프로필 활동 내역">
      <h3>활동 내역</h3>
      <p className="card-meta">익명으로 작성한 글과 질문은 표시하지 않습니다.</p>
      {error ? (
        <div role="alert">
          <p className="form-message error">{error}</p>
          <button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>
            다시 시도
          </button>
        </div>
      ) : !activity ? (
        <p className="card-meta" role="status">활동 내역을 불러오는 중입니다...</p>
      ) : (
        <>
          <div className="profile-subtab-bar" role="tablist" aria-label="활동 종류">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.key}
                id={`${id}-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`${id}-panel`}
                className={`profile-subtab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className="profile-subtab-count">{activity[tab.key].length}</span>
              </button>
            ))}
          </div>
          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeTab}`} className="stack-list">
            {activity[activeTab].length > 0 ? activity[activeTab].map((item) => (
              <article key={item.id} className="surface-card profile-activity-item">
                <h4>
                  <Link href={
                    activeTab === 'posts' ? `/community/posts/${encodeURIComponent(item.id)}` :
                      activeTab === 'questions' ? `/questions/${encodeURIComponent(item.id)}` :
                        `/videos/${encodeURIComponent(item.id)}`
                  }>
                    {item.title}
                  </Link>
                </h4>
                <p className="card-meta content-metrics">
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</time>
                  <ContentMetric kind="view" count={item.viewCount} />
                  <ContentMetric kind="like" count={item.likeCount} />
                </p>
              </article>
            )) : <p className="card-meta">{selectedTab.empty}</p>}
          </div>
        </>
      )}
    </section>
  );
}
