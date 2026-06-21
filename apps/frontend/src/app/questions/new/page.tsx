'use client';

import { useRouter } from 'next/navigation';
import { SiteShell } from '../../../components/site-shell';
import { SectionCard } from '../../../components/section-card';
import { QuestionForm } from '../../../components/forms';
import { useAuthUser } from '../../../components/role-provider';
import { createQuestion } from '../../../lib/api';

async function toAttachmentValue(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export default function NewQuestionPage() {
  const router = useRouter();
  const { authResolved, authUser } = useAuthUser();

  const submitQuestion = async (formData: FormData) => {
    if (!authUser) {
      throw new Error('질문을 작성하려면 로그인해주세요.');
    }

    const files = formData
      .getAll('attachments')
      .filter((entry): entry is File => entry instanceof File)
      .filter((file) => file.size > 0)
      .slice(0, 4);

    const attachments = await Promise.all(files.map((file) => toAttachmentValue(file)));

    const created = await createQuestion({
      title: String(formData.get('title') ?? ''),
      body: String(formData.get('body') ?? ''),
      subject: String(formData.get('subject') ?? ''),
      grade: String(formData.get('grade') ?? ''),
      visibility: formData.get('visibility') === 'nickname' ? 'nickname' : 'anonymous',
      attachments,
      userId: authUser.id,
    });

    router.push(`/questions/${created.id}`);
    router.refresh();
  };

  return (
    <SiteShell title="질문 작성" description="필수값을 빠르게 채우고 바로 등록하는 입력 화면입니다.">
      <SectionCard eyebrow="질문 등록" title="제목, 본문, 과목, 학년만 먼저 정확하게">
        {!authUser && authResolved ? <p className="form-message error">질문 작성은 로그인 후 사용할 수 있습니다.</p> : null}
        <QuestionForm onSubmit={submitQuestion} />
      </SectionCard>
    </SiteShell>
  );
}