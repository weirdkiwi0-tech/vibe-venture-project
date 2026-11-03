import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth';

describe('File uploads API (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let directory: string;
  const originalDirectory = process.env.UPLOADS_DIR;
  const image = Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0uUAAAAASUVORK5CYII=', 'base64'),
    Buffer.alloc(256 * 1024),
  ]);

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'keepit-uploads-'));
    process.env.UPLOADS_DIR = directory;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    const auth = moduleRef.get(AuthService);
    const login = await auth.signInWithGoogle({
      googleId: 'upload-e2e-user',
      email: 'upload-e2e@example.com',
      displayName: 'Upload tester',
    });
    cookie = `keepit-session=${await auth.createSession(login.user.id)}`;
  });

  afterAll(async () => {
    await app.close();
    if (originalDirectory === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  it('rejects uploads without a session, even with a forged user header', async () => {
    const response = await request(app.getHttpServer()).post('/uploads')
      .set('x-user-id', 'upload-e2e-user')
      .attach('file', image, { filename: 'photo.png', contentType: 'image/png' });
    expect(response.status).toBe(401);
  });

  it('stores files larger than a table property and returns their original bytes', async () => {
    const uploaded = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie)
      .attach('file', image, { filename: '../../photo.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toMatchObject({ contentType: 'image/png', size: image.length });
    expect(uploaded.body.url).toMatch(/^\/uploads\/[\da-f-]+\.png$/);
    const downloaded = await request(app.getHttpServer()).get(uploaded.body.url);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['x-content-type-options']).toBe('nosniff');
    expect(downloaded.headers['content-type']).toContain('image/png');
    expect(downloaded.body).toEqual(image);

    const question = await request(app.getHttpServer()).post('/questions').send({
      title: 'Uploaded image question', body: 'Question body', subject: 'MATH', grade: '2',
      attachments: [uploaded.body.url],
    });
    expect(question.status).toBe(201);
    const answer = await request(app.getHttpServer()).post(`/questions/${question.body.id}/answers`)
      .send({ type: 'text', content: 'Answer body', attachments: [uploaded.body.url] });
    expect(answer.status).toBe(201);
    const comment = await request(app.getHttpServer()).post(`/questions/answers/${answer.body.id}/comments`)
      .set('x-user-id', 'upload-e2e-user')
      .send({ content: 'Image comment', attachments: [uploaded.body.url] });
    expect(comment.status).toBe(201);

    const partial = await request(app.getHttpServer()).get(uploaded.body.url).set('Range', 'bytes=0-31');
    expect(partial.status).toBe(206);
    expect(partial.headers['content-range']).toBe(`bytes 0-31/${image.length}`);
    expect(partial.body).toEqual(image.subarray(0, 32));

    const invalidRange = await request(app.getHttpServer()).get(uploaded.body.url)
      .set('Range', `bytes=${image.length + 1}-`);
    expect(invalidRange.status).toBe(416);
  });

  it('rejects executable content disguised as an image', async () => {
    const response = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie)
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'fake.png', contentType: 'image/png' });
    expect(response.status).toBe(400);
  });

  it('accepts WebM uploads and video answer URLs', async () => {
    const webm = Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d4287810242858102', 'hex');
    const uploaded = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie)
      .attach('file', webm, { filename: 'lesson.webm', contentType: 'video/webm' });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.contentType).toBe('video/webm');
    expect(uploaded.body.url).toMatch(/\.webm$/);
    const question = await request(app.getHttpServer()).post('/questions').send({
      title: 'Video question', body: 'Question body', subject: 'MATH', grade: '2',
    });
    const answer = await request(app.getHttpServer()).post(`/questions/${question.body.id}/answers`)
      .send({ type: 'video', content: 'Video explanation', attachments: [uploaded.body.url] });
    expect(answer.status).toBe(201);
  });

  it('rejects mismatched media types', async () => {
    const response = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie)
      .attach('file', image, { filename: 'fake.mp4', contentType: 'video/mp4' });
    expect(response.status).toBe(400);
  });

  it('rejects images exceeding 10 MB', async () => {
    const response = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie)
      .attach('file', Buffer.concat([image, Buffer.alloc(10 * 1024 * 1024)]), {
        filename: 'large.png', contentType: 'image/png',
      });
    expect(response.status).toBe(413);
  });

  it('rejects missing files and returns 404 for unknown files', async () => {
    const response = await request(app.getHttpServer()).post('/uploads').set('Cookie', cookie);
    expect(response.status).toBe(400);
    expect((await request(app.getHttpServer()).get('/uploads/not-a-file.png')).status).toBe(404);
  });
});