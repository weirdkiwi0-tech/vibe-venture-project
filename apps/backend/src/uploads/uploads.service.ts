import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { filetypeinfo } from 'magic-bytes.js';
import { join, resolve } from 'path';

const MEDIA_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

const execute = promisify(execFile);

@Injectable()
export class UploadsService {
  private readonly directory = resolve(process.env.UPLOADS_DIR ?? join(process.cwd(), 'data', 'uploads'));
  private container?: ContainerClient;
  private readonly previews = new Map<string, Promise<string>>();

  async openPreview(name: string) {
    const original = await this.open(name);
    if (!original.contentType.startsWith('video/')) throw new NotFoundException('video preview not found');
    const cacheDirectory = join(this.directory, '.previews');
    const path = join(cacheDirectory, `${name}.mp4`);
    try {
      await stat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      let pending = this.previews.get(name);
      if (!pending) {
        pending = (async () => {
          await mkdir(cacheDirectory, { recursive: true });
          const work = await mkdtemp(join(cacheDirectory, 'render-'));
          try {
            const source = join(work, `source.${name.split('.').pop()}`);
            const output = join(work, 'preview.mp4');
            await pipeline(await original.stream(0, original.size - 1), createWriteStream(source));
            const probe = await execute(process.env.FFPROBE_PATH ?? 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', source], { timeout: 15_000 });
            const duration = Number(JSON.parse(probe.stdout).format?.duration);
            if (!Number.isFinite(duration) || duration <= 0) throw new BadRequestException('invalid video duration');
            await execute(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-v', 'error', '-i', source, '-t', String(duration / 2), '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-movflags', '+faststart', output], { timeout: 120_000 });
            await rename(output, path);
            return path;
          } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new ServiceUnavailableException('video preview unavailable; FFmpeg and ffprobe are required');
          } finally {
            await rm(work, { recursive: true, force: true });
          }
        })();
        this.previews.set(name, pending);
        void pending.finally(() => this.previews.delete(name)).catch(() => undefined);
      }
      await pending;
    }
    return { size: (await stat(path)).size, contentType: 'video/mp4', stream: async (start: number, end: number) => createReadStream(path, { start, end }) };
  }

  private getContainer() {
    if (this.container) return this.container;
    const accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL;
    const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING ?? process.env.AZURE_TABLES_CONNECTION_STRING;
    if (!accountUrl && !connectionString) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('파일 저장소가 설정되지 않았습니다.');
      }
      return undefined;
    }
    const options = { retryOptions: { maxTries: 4, tryTimeoutInMs: 30000 } };
    const client = accountUrl
      ? new BlobServiceClient(accountUrl, new DefaultAzureCredential(), options)
      : BlobServiceClient.fromConnectionString(connectionString!, options);
    this.container = client.getContainerClient(process.env.AZURE_UPLOADS_CONTAINER ?? 'keepit-uploads');
    return this.container;
  }

  async save(file: Express.Multer.File) {
    const contentType = filetypeinfo(file.buffer)
      .map((type) => type.extension === 'webm' ? 'video/webm' : type.mime)
      .find((mime) => mime && MEDIA_TYPES[mime]);
    if (!contentType || (file.mimetype !== contentType && file.mimetype !== 'application/octet-stream')) {
      throw new BadRequestException('지원하지 않거나 내용과 형식이 일치하지 않는 파일입니다. JPG, PNG, WebP, GIF, MP4, MOV, WebM, PDF를 사용해주세요.');
    }
    const limit = (contentType.startsWith('video/') ? 30 : 10) * 1024 * 1024;
    if (file.size > limit) {
      throw new PayloadTooLargeException(contentType.startsWith('video/')
        ? '동영상은 30MB 이하만 업로드할 수 있습니다.'
        : '사진과 문서는 10MB 이하만 업로드할 수 있습니다.');
    }
    const name = `${randomUUID()}.${MEDIA_TYPES[contentType]}`;
    const container = this.getContainer();
    if (container) {
      await container.createIfNotExists();
      await container.getBlockBlobClient(name).uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: 'public, max-age=31536000, immutable' },
      });
    } else {
      await mkdir(this.directory, { recursive: true });
      const temporaryPath = join(this.directory, `${name}.tmp`);
      try {
        await writeFile(temporaryPath, file.buffer, { flag: 'wx' });
        await rename(temporaryPath, join(this.directory, name));
      } finally {
        await rm(temporaryPath, { force: true });
      }
    }
    return { url: `/uploads/${name}`, contentType, size: file.size };
  }

  async open(name: string) {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|png|webp|gif|mp4|mov|webm|pdf)$/.test(name)) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }
    const extension = name.split('.').pop();
    const contentType = Object.entries(MEDIA_TYPES).find(([, value]) => value === extension)![0];
    try {
      const container = this.getContainer();
      if (container) {
        const blob = container.getBlobClient(name);
        const properties = await blob.getProperties();
        return {
          size: properties.contentLength ?? 0,
          contentType,
          stream: async (start: number, end: number) => {
            const result = await blob.download(start, end - start + 1);
            return result.readableStreamBody!;
          },
        };
      }
      const path = join(this.directory, name);
      const info = await stat(path);
      return {
        size: info.size,
        contentType,
        stream: async (start: number, end: number) => createReadStream(path, { start, end }),
      };
    } catch (error) {
      const details = error as { code?: string; statusCode?: number };
      if (details.code === 'ENOENT' || details.statusCode === 404) {
        throw new NotFoundException('파일을 찾을 수 없습니다.');
      }
      throw error;
    }
  }
}