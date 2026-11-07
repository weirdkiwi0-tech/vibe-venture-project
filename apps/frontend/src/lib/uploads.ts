import { getApiBaseUrl } from './api';

const SUPPORTED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf',
]);
const uploadedFiles = new WeakMap<File, string>();

export function videoSource(value: string, member: boolean): string {
  if (member) return value;
  try {
    const url = new URL(value, 'http://keepit.local');
    if (!/^\/uploads\/[\da-f-]{36}\.(mp4|mov|webm)$/.test(url.pathname)) return value;
    url.pathname += '/preview';
    return value.startsWith('/') ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return value;
  }
}

export function validateUpload(file: File) {
  if (!file.size) throw new Error('빈 파일은 업로드할 수 없습니다.');
  if (!SUPPORTED_TYPES.has(file.type)) {
    throw new Error('JPG, PNG, WebP, GIF, MP4, MOV, WebM, PDF 파일을 선택해주세요.');
  }
  const isVideo = file.type.startsWith('video/');
  if (file.size > (isVideo ? 30 : 10) * 1024 * 1024) {
    throw new Error(isVideo ? '동영상은 30MB 이하만 업로드할 수 있습니다.' : '사진과 문서는 10MB 이하만 업로드할 수 있습니다.');
  }
}

export function attachmentKind(value: string): 'image' | 'video' | 'file' {
  if (/^data:video\//i.test(value) || /\.(mp4|mov|webm)(?:[?#]|$)/i.test(value)) return 'video';
  if (/^data:image\//i.test(value) || /\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i.test(value)) return 'image';
  return 'file';
}

export async function prepareProfilePhoto(file: File): Promise<string> {
  validateUpload(file);
  if (!file.type.startsWith('image/')) throw new Error('프로필 사진은 이미지 파일을 선택해주세요.');
  const { default: imageCompression } = await import('browser-image-compression');
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.015,
    maxWidthOrHeight: 256,
    fileType: 'image/jpeg',
    useWebWorker: true,
    maxIteration: 15,
  });
  const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
  if (dataUrl.length > 24000) throw new Error('프로필 사진을 줄이지 못했습니다. 다른 사진으로 다시 시도해주세요.');
  return dataUrl;
}

export async function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  validateUpload(file);
  const cached = uploadedFiles.get(file);
  if (cached) {
    onProgress?.(100);
    return cached;
  }
  const url = await new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${getApiBaseUrl()}/uploads`);
    request.withCredentials = true;
    request.timeout = 120000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(new Error('파일 전송 중 연결이 끊겼습니다. 파일을 유지한 채 다시 등록해주세요.'));
    request.ontimeout = () => reject(new Error('파일 업로드 시간이 초과되었습니다. 네트워크를 확인하고 다시 등록해주세요.'));
    request.onabort = () => reject(new Error('파일 업로드가 취소되었습니다.'));
    request.onload = () => {
      let payload: { url?: string; message?: string | string[] } = {};
      try { payload = JSON.parse(request.responseText); } catch { payload = {}; }
      if (request.status >= 200 && request.status < 300 && /^\/uploads\/[\da-f-]+\.(jpg|png|webp|gif|mp4|mov|webm|pdf)$/.test(payload.url ?? '')) {
        onProgress?.(100);
        resolve(`${getApiBaseUrl()}${payload.url}`);
        return;
      }
      const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message;
      reject(new Error(request.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해주세요.'
        : request.status === 413 ? '파일이 너무 큽니다. 사진·문서는 10MB, 동영상은 30MB 이하로 선택해주세요.'
        : message || '파일을 저장하지 못했습니다. 다시 등록해주세요.'));
    };
    const formData = new FormData();
    formData.append('file', file);
    onProgress?.(0);
    request.send(formData);
  });
  uploadedFiles.set(file, url);
  return url;
}

export async function uploadFiles(files: File[], onProgress?: (percent: number) => void): Promise<string[]> {
  if (files.length > 4) throw new Error('첨부파일은 최대 4개까지 선택할 수 있습니다.');
  files.forEach(validateUpload);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const results: string[] = [];
  let completed = 0;
  for (const file of files) {
    results.push(await uploadFile(file, (percent) => onProgress?.(Math.round((completed + file.size * percent / 100) / total * 100))));
    completed += file.size;
  }
  return results;
}