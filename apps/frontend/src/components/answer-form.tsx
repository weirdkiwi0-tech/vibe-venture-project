'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAnswer } from '../lib/api';
import { useAuthUser } from './role-provider';

type State = { status: 'idle' | 'loading' | 'success' | 'error'; message: string };

async function toAttachmentValue(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

export function AnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const { authUser, authResolved } = useAuthUser();
  const [state, setState] = useState<State>({ status: 'idle', message: '' });
  const [answerType, setAnswerType] = useState<'text' | 'video'>('text');
  const [attachmentLabel, setAttachmentLabel] = useState('선택된 파일 없음');
  const attachmentInputId = useId();

  return (
    <form
      className="form-grid"
      action={async (formData) => {
        setState({ status: 'loading', message: '답변을 등록하는 중입니다.' });
        if (!authUser) {
          setState({ status: 'error', message: '답변을 작성하려면 로그인해주세요.' });
          return;
        }

        try {
          const selectedType = String(formData.get('type') ?? 'text') as 'text' | 'video';
          const files = formData
            .getAll('attachments')
            .filter((entry): entry is File => entry instanceof File)
            .filter((file) => file.size > 0)
            .slice(0, 4);

          if (selectedType === 'video' && files.some((file) => !file.type.startsWith('video/'))) {
            throw new Error('풀이 영상 첨부는 동영상 파일만 업로드할 수 있습니다.');
          }

          const attachments = await Promise.all(files.map((file) => toAttachmentValue(file)));

          await createAnswer({
            questionId,
            type: selectedType,
            content: String(formData.get('content') ?? ''),
            attachments,
            userId: authUser.id,
          });
          setState({ status: 'success', message: '답변이 등록되었습니다.' });
          router.refresh();
        } catch (error) {
          const message = error instanceof Error && error.message
            ? error.message
            : '답변 등록에 실패했습니다.';
          setState({ status: 'error', message });
        }
      }}
    >
      <label>
        답변 타입
        <select
          name="type"
          value={answerType}
          onChange={(event) => {
            const nextType = event.target.value === 'video' ? 'video' : 'text';
            setAnswerType(nextType);
            setAttachmentLabel('선택된 파일 없음');
          }}
        >
          <option value="text">text</option>
          <option value="video">video</option>
        </select>
      </label>
      <label>
        답변 내용
        <textarea name="content" rows={5} required />
      </label>
      <label>
        첨부 자료
        <input
          key={answerType}
          id={attachmentInputId}
          className="file-input-hidden"
          name="attachments"
          type="file"
          accept={answerType === 'video' ? 'video/*' : 'image/*,video/*,application/pdf'}
          multiple
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            const names = selectedFiles.map((file) => file.name);
            if (answerType === 'video' && selectedFiles.some((file) => !file.type.startsWith('video/'))) {
              setState({ status: 'error', message: '풀이 영상 첨부는 동영상 파일만 선택할 수 있습니다.' });
              event.currentTarget.value = '';
              setAttachmentLabel('선택된 파일 없음');
              return;
            }

            setAttachmentLabel(names.length > 0 ? names.join(', ') : '선택된 파일 없음');
          }}
        />
        <div className="file-picker-row">
          <label
            htmlFor={attachmentInputId}
            className="file-picker-button"
            aria-disabled={!authResolved || !authUser || state.status === 'loading'}
          >
            자료 추가
          </label>
          <span className="file-picker-name">{attachmentLabel}</span>
        </div>
      </label>
      <button type="submit" className="primary-button" disabled={!authResolved || !authUser || state.status === 'loading'}>
        답변 등록
      </button>
      {!authUser && authResolved ? <p className="form-message error">답변 작성은 로그인 후 사용할 수 있습니다.</p> : null}
      {state.message ? <p className={`form-message ${state.status}`}>{state.message}</p> : null}
    </form>
  );
}