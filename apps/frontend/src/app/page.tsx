import Link from 'next/link';
import { headers } from 'next/headers';
import { SiteShell } from '../components/site-shell';
import { SectionCard } from '../components/section-card';
import { QuestionList, VideoGrid } from '../components/feed-cards';
import { getHomeFeed } from '../lib/api';

type TopQuestionItem = {
  id: string;
  likeCount: number;
  createdAt: string;
};

function applyTopQuestionPolicy<T extends TopQuestionItem>(questions: T[]): T[] {
  if (questions.length <= 10) {
    return questions.slice(0, 10);
  }

  const byPopular = [...questions].sort((a, b) => {
    if (b.likeCount !== a.likeCount) {
      return b.likeCount - a.likeCount;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const popular = byPopular.slice(0, 7);
  const popularIds = new Set(popular.map((item) => item.id));
  const helpNeeded = questions
    .filter((item) => !popularIds.has(item.id))
    .sort((a, b) => {
      if (a.likeCount !== b.likeCount) {
        return a.likeCount - b.likeCount;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 3);

  return [...popular, ...helpNeeded];
}

export default async function HomePage() {
  const cookieHeader = (await headers()).get('cookie') ?? undefined;

  let data: Awaited<ReturnType<typeof getHomeFeed>> | null = null;
  let feedLoadError = false;

  try {
    data = await getHomeFeed(cookieHeader);
  } catch {
    feedLoadError = true;
  }

  return (
    <SiteShell title="" description="">

      {feedLoadError || !data ? (
        <SectionCard eyebrow="일시 장애" title="피드를 불러오지 못했습니다">
          <p>
            현재 피드 API 연결이 불안정합니다. 잠시 후 다시 시도하거나,
            아래 메뉴에서 개별 화면으로 이동해 주세요.
          </p>
          <div className="hero-actions">
            <Link href="/questions" className="secondary-button">
              질문 페이지로 이동
            </Link>
            <Link href="/videos" className="secondary-button">
              영상 페이지로 이동
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
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
            <QuestionList questions={applyTopQuestionPolicy(data.feed.questions)} autoSlide itemsPerSlide={2} />
          </SectionCard>
        </>
      )}
    </SiteShell>
  );
}
