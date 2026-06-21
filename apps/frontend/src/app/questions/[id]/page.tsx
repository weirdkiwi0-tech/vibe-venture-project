import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AnswerForm } from '../../../components/answer-form';
import { QuestionAnswerList, QuestionDetailCard } from '../../../components/question-detail-cards';
import { SiteShell } from '../../../components/site-shell';
import { SectionCard } from '../../../components/section-card';
import { getQuestion, getQuestionAnswers } from '../../../lib/api';

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = (await headers()).get('cookie') ?? undefined;

  try {
    const [question, answers] = await Promise.all([getQuestion(id, cookieHeader), getQuestionAnswers(id)]);

    return (
      <SiteShell title="질문 상세" description="질문 맥락, 답변, 해결 상태를 한 화면에서 확인합니다.">
        <SectionCard eyebrow="질문" title={question.title}>
          <QuestionDetailCard question={question} />
        </SectionCard>

        <SectionCard eyebrow="답변" title="답변 달기">
          <AnswerForm questionId={question.id} />
        </SectionCard>

        <SectionCard eyebrow="이전 답변" title="등록된 답변 목록">
          <QuestionAnswerList initialAnswers={answers} />
        </SectionCard>
      </SiteShell>
    );
  } catch {
    notFound();
  }
}