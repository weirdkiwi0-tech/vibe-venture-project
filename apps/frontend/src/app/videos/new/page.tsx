'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SiteShell } from '../../../components/site-shell';
import { SectionCard } from '../../../components/section-card';
import { useAuthUser } from '../../../components/role-provider';
import { createVideo } from '../../../lib/api';

const MAX_VIDEO_FILE_SIZE_BYTES = 30 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('영상 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function getVideoDurationSeconds(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = objectUrl;

      video.onloadedmetadata = () => {
        resolve(video.duration || 0);
      };

      video.onerror = () => {
        reject(new Error('영상 길이를 확인하지 못했습니다.'));
      };
    });

    return duration;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const VIDEO_SUBJECTS = ['수학', '영어', '국어', '과학', '사회', '기타'] as const;

export default function NewVideoPage() {
  const router = useRouter();
  const { authUser, authResolved } = useAuthUser();
  const inputId = useId();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<(typeof VIDEO_SUBJECTS)[number]>('수학');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSelectVideo = (file: File | null) => {
    setVideoFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : '');
    setDuration(0);
    if (file && file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setState('error');
      setMessage('영상 파일이 너무 큽니다. 30MB 이하 영상으로 다시 시도해주세요.');
      return;
    }

    setState('idle');
    setMessage('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!authUser) {
      setState('error');
      setMessage('영상 업로드는 로그인 후 사용할 수 있습니다.');
      return;
    }

    if (!videoFile) {
      setState('error');
      setMessage('영상 파일을 선택해주세요.');
      return;
    }

    if (videoFile.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setState('error');
      setMessage('영상 파일이 너무 큽니다. 30MB 이하 영상으로 다시 시도해주세요.');
      return;
    }

    if (!title.trim()) {
      setState('error');
      setMessage('영상 제목을 입력해주세요.');
      return;
    }

    setState('loading');
    setMessage('영상을 업로드하는 중입니다...');

    try {
      const resolvedDuration = duration > 0 ? duration : await getVideoDurationSeconds(videoFile);
      const url = await fileToDataUrl(videoFile);
      const created = await createVideo({
        title: title.trim(),
        subject,
        url,
        durationSeconds: Math.max(1, Math.round(resolvedDuration)),
        userId: authUser.id,
      });

      router.push(`/videos?focus=${encodeURIComponent(created.id)}`);
      router.refresh();
    } catch (error) {
      setState('error');
      const errorMessage = error instanceof Error ? error.message : '영상 업로드에 실패했습니다.';
      if (errorMessage.toLowerCase().includes('payload too large')) {
        setMessage('영상 파일이 너무 커서 업로드할 수 없습니다. 30MB 이하 영상으로 다시 시도해주세요.');
        return;
      }
      setMessage(errorMessage);
    }
  };

  return (
    <SiteShell title="풀이 영상찍기" description="댓글 대신, 영상 풀이를 바로 올리고 재생할 수 있습니다.">
      <SectionCard eyebrow="영상 업로드" title="카메라 촬영 또는 파일 선택">
        {!authUser && authResolved ? <p className="form-message error">로그인 후 영상 업로드가 가능합니다.</p> : null}

        <form className="form-grid" onSubmit={submit}>
          <label>
            영상 제목
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 수학 1 함수 문제 풀이"
              required
            />
          </label>

          <label>
            과목 선택
            <select value={subject} onChange={(event) => setSubject(event.target.value as (typeof VIDEO_SUBJECTS)[number])}>
              {VIDEO_SUBJECTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            영상 파일
            <input
              id={inputId}
              className="file-input-hidden"
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(event) => handleSelectVideo(event.target.files?.[0] ?? null)}
            />
            <div className="file-picker-row">
              <label htmlFor={inputId} className="file-picker-button">영상 선택/촬영</label>
              <span className="file-picker-name">{videoFile?.name ?? '선택된 파일 없음'}</span>
            </div>
          </label>

          {previewUrl ? (
            <div className="surface-card" style={{ padding: '0.8rem' }}>
              <div className="card-meta">미리보기 {duration > 0 ? `· ${formatDuration(Math.round(duration))}` : ''}</div>
              <video
                src={previewUrl}
                controls
                style={{ width: '100%', borderRadius: '12px', marginTop: '0.5rem' }}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
              />
            </div>
          ) : null}

          <button type="submit" className="primary-button" disabled={!authUser || state === 'loading'}>
            {state === 'loading' ? '업로드 중...' : '영상 업로드'}
          </button>

          {message ? <p className={`form-message ${state === 'error' ? 'error' : 'idle'}`}>{message}</p> : null}
        </form>
      </SectionCard>
    </SiteShell>
  );
}
