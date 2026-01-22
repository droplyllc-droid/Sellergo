/**
 * Uploads Controller
 */

import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';

// Define Multer file interface locally to avoid dependency on @types/multer
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = /image\/(jpeg|png|gif|webp|svg\+xml)|application\/pdf/;

@ApiTags('Uploads')
@Controller('stores/:storeId/uploads')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  async uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_MIME_TYPES }),
        ],
      }),
    )
    file: MulterFile,
  ) {
    return this.uploadsService.uploadFile(file, user.tenantId, storeId, {
      folder: 'images',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    });
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded successfully' })
  async uploadImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @UploadedFiles() files: MulterFile[],
  ) {
    return this.uploadsService.uploadMultiple(files, user.tenantId, storeId, {
      folder: 'images',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    });
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions(Permission.STORE_UPDATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /application\/pdf/ }),
        ],
      }),
    )
    file: MulterFile,
  ) {
    return this.uploadsService.uploadFile(file, user.tenantId, storeId, {
      folder: 'documents',
      allowedTypes: ['application/pdf'],
    });
  }

  @Post('presigned-url')
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiOperation({ summary: 'Get presigned upload URL for direct upload' })
  @ApiResponse({ status: 201, description: 'Presigned URL generated' })
  async getPresignedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() body: { filename: string; contentType: string; folder?: string },
  ) {
    return this.uploadsService.getPresignedUploadUrl(
      user.tenantId,
      storeId,
      body.filename,
      body.contentType,
      body.folder,
    );
  }

  @Delete(':key')
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an uploaded file' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  async deleteFile(@Param('key') key: string) {
    await this.uploadsService.deleteFile(key);
    return;
  }
}
