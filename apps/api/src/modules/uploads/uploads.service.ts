/**
 * Uploads Service
 * S3-compatible file upload handling
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { ErrorCode } from '@sellergo/types';

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
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY');
    const secretKey = this.configService.get<string>('S3_SECRET_KEY');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');

    this.bucket = this.configService.get<string>('S3_BUCKET', 'sellergo-uploads');
    this.endpoint = endpoint || '';

    if (accessKey && secretKey) {
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true, // Required for MinIO
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
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
    files: Express.Multer.File[],
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
