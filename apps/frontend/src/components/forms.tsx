'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

type ResultState = { status: 'idle' | 'loading' | 'success' | 'error'; message: string };

export function QuestionForm({ onSubmit }: { onSubmit: (formData: FormData) => Promise<void> }) {
  const [result, setResult] = useState<ResultState>({ status: 'idle', message: '' });
  const [attachmentLabel, setAttachmentLabel] = useState('선택된 파일 없음');
  const [subjectSelection, setSubjectSelection] = useState('수학');
  const [customSubject, setCustomSubject] = useState('');
  const attachmentInputId = useId();
  const isLoading = result.status === 'loading';
  const resolvedSubject = subjectSelection === '기타' ? customSubject.trim() : subjectSelection;

  return (
    <form
      className="form-grid"
      action={async (formData) => {
        if (!resolvedSubject) {
          setResult({ status: 'error', message: '기타를 선택한 경우 과목명을 입력해주세요.' });
          return;
        }

        setResult({ status: 'loading', message: '질문을 등록하는 중입니다.' });
        try {
          await onSubmit(formData);
          setResult({ status: 'success', message: '질문이 등록되었습니다.' });
        } catch {
          setResult({ status: 'error', message: '등록에 실패했습니다.' });
        }
      }}
    >
      <label>
        제목
        <input name="title" required />
      </label>
      <label>
        본문
        <textarea name="body" rows={6} required />
      </label>
      <div className="form-row">
        <label className="subject-select-group">
          과목
          <select
            value={subjectSelection}
            onChange={(event) => {
              setSubjectSelection(event.target.value);
              if (event.target.value !== '기타') {
                setCustomSubject('');
              }
            }}
          >
            <optgroup label="주요 과목">
              <option value="국어">국어</option>
              <option value="영어">영어</option>
              <option value="수학">수학</option>
              <option value="사회">사회</option>
              <option value="과학">과학</option>
            </optgroup>
            <optgroup label="탐구 과목">
              <option value="물리">물리</option>
              <option value="화학">화학</option>
              <option value="생명과학">생명과학</option>
              <option value="지구과학">지구과학</option>
              <option value="한국사">한국사</option>
            </optgroup>
            <optgroup label="기타 선택">
              <option value="정보">정보</option>
              <option value="제2외국어/한문">제2외국어/한문</option>
              <option value="기타">기타(직접 입력)</option>
            </optgroup>
          </select>
          {subjectSelection === '기타' ? (
            <input
              className="subject-custom-input"
              placeholder="직접 입력 (예: 미술, 음악, 체육)"
              value={customSubject}
              onChange={(event) => setCustomSubject(event.target.value)}
              maxLength={30}
              required
            />
          ) : null}
          <input type="hidden" name="subject" value={resolvedSubject} readOnly required />
        </label>
        <label>
          학년
          <select name="grade" defaultValue="1">
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
        </label>
      </div>
      <label>
        익명 여부
        <select name="visibility" defaultValue="anonymous">
          <option value="anonymous">익명</option>
          <option value="nickname">닉네임</option>
        </select>
      </label>
      <label>
        첨부 자료
        <input
          id={attachmentInputId}
          className="file-input-hidden"
          name="attachments"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(event) => {
            const names = Array.from(event.target.files ?? []).map((file) => file.name);
            setAttachmentLabel(names.length > 0 ? names.join(', ') : '선택된 파일 없음');
          }}
        />
        <div className="file-picker-row">
          <label htmlFor={attachmentInputId} className="file-picker-button" aria-disabled={isLoading}>
            자료 추가
          </label>
          <span className="file-picker-name">{attachmentLabel}</span>
        </div>
      </label>
      <button type="submit" className="primary-button" disabled={isLoading}>
        {isLoading ? '등록 중...' : '질문 등록'}
      </button>
      {result.message ? <p className={`form-message ${result.status}`}>{result.message}</p> : null}
    </form>
  );
}

export function ReportForm({ onSubmit }: { onSubmit: (formData: FormData) => Promise<void> }) {
  return <ReportFormWithDefaults onSubmit={onSubmit} />;
}

export function ReportFormWithDefaults({
  onSubmit,
  initialValues,
  redirectOnSuccessTo,
}: {
  onSubmit: (formData: FormData) => Promise<void>;
  initialValues?: {
    targetType?: 'question' | 'answer' | 'video' | 'comment' | 'community-post';
    targetId?: string;
    reason?: string;
    details?: string;
    severity?: 'normal' | 'high';
    sourceLabel?: string;
  };
  redirectOnSuccessTo?: Route;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ResultState>({ status: 'idle', message: '' });
  const [detailsValue, setDetailsValue] = useState(initialValues?.details ?? '');
  const [detailsInvalid, setDetailsInvalid] = useState(false);
  const isLoading = result.status === 'loading';

  return (
    <form
      className="form-grid"
      action={async (formData) => {
        const details = String(formData.get('details') ?? '').trim();
        if (details.length < 20) {
          setDetailsInvalid(true);
          setResult({ status: 'error', message: '상세사유를 적어주세요. (20자 이상)' });
          return;
        }

        setResult({ status: 'loading', message: '신고를 접수하는 중입니다.' });
        try {
          await onSubmit(formData);
          setDetailsInvalid(false);
          setResult({ status: 'success', message: '신고가 접수되었습니다.' });
          if (redirectOnSuccessTo) {
            router.push(redirectOnSuccessTo as Route);
            router.refresh();
          }
        } catch {
          setResult({ status: 'error', message: '신고 접수에 실패했습니다.' });
        }
      }}
    >
      {initialValues?.sourceLabel ? <p className="auth-status">신고 대상: {initialValues.sourceLabel}</p> : null}
      <div className="form-row">
        <label>
          대상 타입
          <select name="targetType" defaultValue={initialValues?.targetType ?? 'question'}>
            <option value="question">질문</option>
            <option value="answer">답변</option>
            <option value="comment">댓글/답글</option>
            <option value="community-post">커뮤니티 게시글</option>
            <option value="video">영상</option>
          </select>
        </label>
        <label>
          대상 ID
          <input name="targetId" defaultValue={initialValues?.targetId ?? ''} required />
        </label>
      </div>
      <label>
        사유
        <input name="reason" defaultValue={initialValues?.reason ?? ''} required />
      </label>
      <label>
        상세 사유
        <textarea
          name="details"
          rows={4}
          value={detailsValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDetailsValue(nextValue);
            if (nextValue.trim().length >= 20) {
              setDetailsInvalid(false);
            }
          }}
          className={detailsInvalid ? 'report-details-error' : undefined}
        />
      </label>
      <label>
        심각도
        <select name="severity" defaultValue={initialValues?.severity ?? 'normal'}>
          <option value="normal">normal</option>
          <option value="high">high</option>
        </select>
      </label>
      <button type="submit" className="primary-button" disabled={isLoading}>
        {isLoading ? '접수 중...' : '신고 접수'}
      </button>
      {result.message ? <p className={`form-message ${result.status}`}>{result.message}</p> : null}
    </form>
  );
}