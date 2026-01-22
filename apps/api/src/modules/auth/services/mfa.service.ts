/**
 * MFA Service
 * Handles Multi-Factor Authentication with TOTP
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as OTPAuth from 'otpauth';

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

@Injectable()
export class MfaService {
  private readonly issuer: string;
  private readonly algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  private readonly digits: number;
  private readonly period: number;
  private readonly backupCodeCount: number;

  constructor(private readonly configService: ConfigService) {
    this.issuer = this.configService.get<string>('app.name', 'Sellergo');
    this.algorithm = 'SHA256';
    this.digits = 6;
    this.period = 30;
    this.backupCodeCount = 10;
  }

  /**
   * Generate MFA setup data (secret, QR code URL, backup codes)
   */
  generateSetup(email: string): MfaSetupResult {
    // Generate a secure secret
    const secretBuffer = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBuffer);

    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      issuer: this.issuer,
      label: email,
      algorithm: this.algorithm,
      digits: this.digits,
      period: this.period,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Generate QR code URL (otpauth:// URI)
    const qrCodeUrl = totp.toString();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify a TOTP code
   */
  verifyCode(secret: string, code: string): boolean {
    try {
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        algorithm: this.algorithm,
        digits: this.digits,
        period: this.period,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      // Allow 1 period drift (30 seconds before and after)
      const delta = totp.validate({ token: code, window: 1 });

      return delta !== null;
    } catch {
      return false;
    }
  }

  /**
   * Alias for verifyCode - verify TOTP code
   */
  verifyTotp(code: string, secret: string): boolean {
    return this.verifyCode(secret, code);
  }

  /**
   * Alias for generateSetup - generate MFA secret and setup data
   */
  async generateSecret(email: string): Promise<MfaSetupResult> {
    return this.generateSetup(email);
  }

  /**
   * Verify a backup code
   */
  verifyBackupCode(
    hashedCodes: string[],
    code: string,
  ): { valid: boolean; remainingCodes: string[] } {
    const normalizedCode = code.replace(/\s/g, '').toUpperCase();
    const codeHash = this.hashBackupCode(normalizedCode);

    const index = hashedCodes.findIndex((hashed) => hashed === codeHash);

    if (index === -1) {
      return { valid: false, remainingCodes: hashedCodes };
    }

    // Remove the used code
    const remainingCodes = [...hashedCodes];
    remainingCodes.splice(index, 1);

    return { valid: true, remainingCodes };
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];

    for (let i = 0; i < this.backupCodeCount; i++) {
      // Generate 8 character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  hashBackupCodes(codes: string[]): string[] {
    return codes.map((code) => this.hashBackupCode(code.replace(/\s|-/g, '')));
  }

  /**
   * Hash a single backup code
   */
  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  }

  /**
   * Encode bytes to base32
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }

    return result;
  }

  /**
   * Generate a QR code data URL for the TOTP secret
   */
  async generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
    // We'll use a simple implementation that returns the URL
    // In production, you might want to use a QR code library
    // For now, return the otpauth URL which can be rendered client-side
    return otpauthUrl;
  }

  /**
   * Validate MFA code format
   */
  validateCodeFormat(code: string): boolean {
    // TOTP codes are 6 digits
    return /^\d{6}$/.test(code.trim());
  }

  /**
   * Validate backup code format
   */
  validateBackupCodeFormat(code: string): boolean {
    // Backup codes are XXXX-XXXX format (alphanumeric)
    const normalized = code.replace(/\s|-/g, '');
    return /^[A-Z0-9]{8}$/i.test(normalized);
  }

  /**
   * Determine if input is a backup code or TOTP code
   */
  isBackupCode(code: string): boolean {
    return this.validateBackupCodeFormat(code) && !this.validateCodeFormat(code);
  }
}
