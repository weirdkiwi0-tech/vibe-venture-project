import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises';
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

@Injectable()
export class UploadsService {
  private readonly directory = resolve(process.env.UPLOADS_DIR ?? join(process.cwd(), 'data', 'uploads'));
  private container?: ContainerClient;

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