/**
 * Uploads Service
 * S3-compatible file upload handling
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { ErrorCode } from '@sellergo/types';

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

// Stub types for AWS SDK (actual implementation requires @aws-sdk/client-s3)
interface S3Client {
  send(command: unknown): Promise<unknown>;
}
interface PutObjectCommandInput {
  Bucket: string;
  Key: string;
  Body?: Buffer;
  ContentType?: string;
  Metadata?: Record<string, string>;
}
interface DeleteObjectCommandInput {
  Bucket: string;
  Key: string;
}
interface GetObjectCommandInput {
  Bucket: string;
  Key: string;
}
class PutObjectCommand {
  constructor(public input: PutObjectCommandInput) {}
}
class DeleteObjectCommand {
  constructor(public input: DeleteObjectCommandInput) {}
}
class GetObjectCommand {
  constructor(public input: GetObjectCommandInput) {}
}

// Stub for getSignedUrl from @aws-sdk/s3-request-presigner
async function getSignedUrl(
  _client: S3Client | null,
  command: PutObjectCommand | GetObjectCommand,
  _options: { expiresIn?: number },
): Promise<string> {
  // Stub implementation - returns a placeholder URL
  const key = (command as GetObjectCommand).input?.Key || 'unknown';
  return `/uploads/${key}`;
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface UploadOptions {
  folder?: string;
  maxSize?: number;
  allowedTypes?: string[];
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private endpoint: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'sellergo-uploads');
    this.endpoint = this.configService.get<string>('S3_ENDPOINT') || '';

    // S3 client initialization requires @aws-sdk/client-s3 package
    // When the package is available, initialize the client here:
    // const accessKey = this.configService.get<string>('S3_ACCESS_KEY');
    // const secretKey = this.configService.get<string>('S3_SECRET_KEY');
    // if (accessKey && secretKey) { this.s3Client = new S3Client({...}); }
    this.s3Client = null;
  }

  async uploadFile(
    file: MulterFile,
    tenantId: string,
    storeId: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const { folder = 'uploads', maxSize = DEFAULT_MAX_SIZE, allowedTypes = DEFAULT_ALLOWED_TYPES } = options;

    // Validate file size
    if (file.size > maxSize) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`,
      });
    }

    // Validate file type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `File type ${file.mimetype} is not allowed`,
      });
    }

    // Generate unique key
    const ext = path.extname(file.originalname);
    const key = `${tenantId}/${storeId}/${folder}/${uuidv4()}${ext}`;

    if (!this.s3Client) {
      // Development fallback - return a placeholder URL
      this.logger.warn('S3 client not configured, returning placeholder URL');
      return {
        url: `/uploads/${key}`,
        key,
        bucket: this.bucket,
        size: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
      };
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            tenantId,
            storeId,
            originalName: file.originalname,
          },
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;

      return {
        url,
        key,
        bucket: this.bucket,
        size: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error}`);
      throw new BadRequestException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to upload file',
      });
    }
  }

  async uploadMultiple(
    files: MulterFile[],
    tenantId: string,
    storeId: string,
    options: UploadOptions = {},
  ): Promise<UploadResult[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, tenantId, storeId, options)));
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) {
      this.logger.warn('S3 client not configured');
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error}`);
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3Client) {
      return `/uploads/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getPresignedUploadUrl(
    tenantId: string,
    storeId: string,
    filename: string,
    contentType: string,
    folder = 'uploads',
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    if (!this.s3Client) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'File upload not configured',
      });
    }

    const ext = path.extname(filename);
    const key = `${tenantId}/${storeId}/${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 }); // 5 minutes
    const publicUrl = `${this.endpoint}/${this.bucket}/${key}`;

    return { uploadUrl, key, publicUrl };
  }
}
