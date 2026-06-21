import Link from 'next/link';
import { headers } from 'next/headers';
import { SiteShell } from '../components/site-shell';
import { SectionCard } from '../components/section-card';
import { StatsStrip } from '../components/stats-strip';
import { QuestionList, VideoGrid } from '../components/feed-cards';
import { getHomeFeed } from '../lib/api';

export default async function HomePage() {
  const cookieHeader = (await headers()).get('cookie') ?? undefined;
  const data = await getHomeFeed(cookieHeader);

  return (
    <SiteShell
      title="질문, 영상, 운영을 한 화면에 모은 KeepIt 홈"
      description="고등학생 질문-답변 커뮤니티와 멘토링 운영을 위한 첫 번째 제품 화면입니다."
    >
      <section className="hero-card">
        <div>
          <span className="eyebrow">MVP Dashboard</span>
          <h2>질문과 답변이 흐르고, 운영자는 바로 처리하는 구조</h2>
          <p>
            홈 피드는 영상 TOP과 질문 TOP을 한 번에 보여줍니다. 신고와 운영 로그,
            멘토링 SLA 상태도 다음 단계로 바로 확장할 수 있도록 같은 디자인 언어로
            묶었습니다.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" href="/questions/new">
            질문 작성
          </Link>
          <Link className="secondary-button" href="/profile">
            내 프로필
          </Link>
        </div>
      </section>

      <StatsStrip
        items={[
          { label: '영상 수', value: String(data.metadata.videoCount), hint: '홈 상단 섹션 기준' },
          { label: '질문 수', value: String(data.metadata.questionCount), hint: '오늘의 TOP 피드' },
          { label: '갱신 시각', value: new Date(data.metadata.generatedAt).toLocaleTimeString('ko-KR') },
        ]}
      />

      <SectionCard eyebrow="영상 TOP" title="오늘의 top 영상">
        <VideoGrid videos={data.feed.videos.slice(0, 3)} />
      </SectionCard>

      <SectionCard
        eyebrow="질문 TOP"
        title="인기 7 + 도움필요 3"
        action={
          <Link href="/questions" className="secondary-button">
            모든 질문 보기
          </Link>
        }
      >
        <QuestionList questions={data.feed.questions} autoSlide itemsPerSlide={2} />
      </SectionCard>
    </SiteShell>
  );
}
