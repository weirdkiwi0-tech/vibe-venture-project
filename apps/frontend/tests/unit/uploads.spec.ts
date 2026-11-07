import { attachmentKind, prepareProfilePhoto, uploadFile, uploadFiles, videoSource } from '../../src/lib/uploads';

jest.mock('../../src/lib/api', () => ({ getApiBaseUrl: () => 'http://localhost:3001' }));
jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { getDataUrlFromFile: jest.fn() }),
}));

class UploadRequest {
  static instances: UploadRequest[] = [];
  status = 201;
  responseText = '{"url":"/uploads/11111111-1111-1111-1111-111111111111.png"}';
  withCredentials = false;
  timeout = 0;
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  open = jest.fn();
  send = jest.fn<void, [FormData]>();
  constructor() { UploadRequest.instances.push(this); }
}

describe('media uploads', () => {
  it('uses protected previews only for guest uploaded videos', () => {
    const url = 'http://localhost:3001/uploads/11111111-1111-1111-1111-111111111111.mp4';
    expect(videoSource(url, false)).toBe(`${url}/preview`);
    expect(videoSource(url, true)).toBe(url);
    expect(videoSource('/uploads/11111111-1111-1111-1111-111111111111.webm', false)).toMatch(/\/preview$/);
    expect(videoSource('https://stream.test/external.mp4', false)).toBe('https://stream.test/external.mp4');
  });
  const originalRequest = global.XMLHttpRequest;
  beforeEach(() => {
    UploadRequest.instances = [];
    global.XMLHttpRequest = UploadRequest as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => { global.XMLHttpRequest = originalRequest; });

  it('sends multipart with a session and reports progress without base64', async () => {
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const progress = jest.fn();
    const pending = uploadFile(file, progress);
    const request = UploadRequest.instances[0];
    expect(request.open).toHaveBeenCalledWith('POST', 'http://localhost:3001/uploads');
    expect(request.withCredentials).toBe(true);
    expect(request.send.mock.calls[0][0].get('file')).toBe(file);
    request.upload.onprogress?.({ lengthComputable: true, loaded: 2, total: 4 });
    expect(progress).toHaveBeenCalledWith(50);
    request.onload?.();
    await expect(pending).resolves.toBe('http://localhost:3001/uploads/11111111-1111-1111-1111-111111111111.png');
    await uploadFile(file);
    expect(UploadRequest.instances).toHaveLength(1);
  });

  it('keeps failed uploads retryable', async () => {
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const failed = uploadFile(file);
    UploadRequest.instances[0].onerror?.();
    await expect(failed).rejects.toThrow('연결이 끊겼습니다');
    const retried = uploadFile(file);
    UploadRequest.instances[1].onload?.();
    await expect(retried).resolves.toContain('/uploads/');
  });

  it.each([[401, '로그인이 만료'], [413, '파일이 너무 큽니다'], [503, '저장소 오류']])(
    'explains HTTP %s failures', async (status, message) => {
      const pending = uploadFile(new File(['photo'], 'photo.png', { type: 'image/png' }));
      const request = UploadRequest.instances[0];
      request.status = status as number;
      request.responseText = '{"message":"저장소 오류"}';
      request.onload?.();
      await expect(pending).rejects.toThrow(message as string);
    },
  );

  it('explains timeouts', async () => {
    const pending = uploadFile(new File(['photo'], 'photo.png', { type: 'image/png' }));
    UploadRequest.instances[0].ontimeout?.();
    await expect(pending).rejects.toThrow('시간이 초과');
  });

  it('validates every file before starting any upload', async () => {
    await expect(uploadFiles([
      new File(['photo'], 'photo.png', { type: 'image/png' }),
      new File(['script'], 'script.svg', { type: 'image/svg+xml' }),
    ])).rejects.toThrow('파일을 선택');
    expect(UploadRequest.instances).toHaveLength(0);
    await expect(uploadFiles(Array.from({ length: 5 }, () => new File(['photo'], 'photo.png', { type: 'image/png' }))))
      .rejects.toThrow('최대 4개');
    await expect(uploadFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })))
      .rejects.toThrow('10MB');
  });

  it('renders new file URLs and legacy data URLs by media type', () => {
    expect(attachmentKind('https://api.example/uploads/video.mp4')).toBe('video');
    expect(attachmentKind('https://api.example/uploads/photo.png')).toBe('image');
    expect(attachmentKind('data:video/webm;base64,abc')).toBe('video');
    expect(attachmentKind('data:image/png;base64,abc')).toBe('image');
    expect(attachmentKind('https://api.example/uploads/document.pdf')).toBe('file');
  });

  it('optimizes profile photos to fit table storage limits', async () => {
    const compression = (await import('browser-image-compression')).default;
    const file = new File(['photo'], 'profile.png', { type: 'image/png' });
    jest.mocked(compression).mockResolvedValue(file);
    jest.mocked(compression.getDataUrlFromFile).mockResolvedValue('data:image/jpeg;base64,small');
    await expect(prepareProfilePhoto(file)).resolves.toBe('data:image/jpeg;base64,small');
    expect(compression).toHaveBeenCalledWith(file, expect.objectContaining({ maxWidthOrHeight: 256, fileType: 'image/jpeg' }));
    jest.mocked(compression.getDataUrlFromFile).mockResolvedValue('a'.repeat(24001));
    await expect(prepareProfilePhoto(file)).rejects.toThrow('줄이지 못했습니다');
  });
});