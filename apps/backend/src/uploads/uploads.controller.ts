import { BadRequestException, CanActivate, Controller, ExecutionContext, Get, Injectable, Param, Post, Req, Res, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import rangeParser from 'range-parser';
import { pipeline } from 'stream/promises';
import { AuthService } from '../auth';
import { UploadsService } from './uploads.service';

@Injectable()
export class UploadSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.authService.getUserBySessionId(request.cookies?.['keepit-session']);
    if (!user) throw new UnauthorizedException('파일 업로드는 로그인 후 사용할 수 있습니다.');
    return true;
  }
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseGuards(UploadSessionGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.size) throw new BadRequestException('업로드할 파일을 선택해주세요.');
    return this.uploads.save(file);
  }

  @Get(':name')
  async download(@Param('name') name: string, @Req() request: Request, @Res() response: Response) {
    const file = await this.uploads.open(name);
    response.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': file.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `${file.contentType === 'application/pdf' ? 'attachment' : 'inline'}; filename="${name}"`,
    });
    let start = 0;
    let end = file.size - 1;
    if (request.headers.range) {
      const ranges = rangeParser(file.size, request.headers.range);
      if (typeof ranges === 'number' || ranges.type !== 'bytes' || ranges.length !== 1) {
        response.status(416).set('Content-Range', `bytes */${file.size}`).end();
        return;
      }
      start = ranges[0].start;
      end = ranges[0].end;
      response.status(206).set('Content-Range', `bytes ${start}-${end}/${file.size}`);
    }
    response.set('Content-Length', String(end - start + 1));
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = await file.stream(start, end);
    await pipeline(stream, response);
  }
}