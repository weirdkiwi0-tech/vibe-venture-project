import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { UploadsController, UploadSessionGuard } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadSessionGuard],
})
export class UploadsModule {}