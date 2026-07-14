import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'node:net';
import type { Readable } from 'node:stream';

import { PackageDocumentScanUnavailableError } from './package-document.errors';

export type PackageDocumentScanInput = {
  contentType: string;
  contentLength: number;
  stream: Readable;
};

export type PackageDocumentScanResult =
  | { safe: true }
  | { safe: false; reason: 'INVALID_SIGNATURE' | 'ENCRYPTED_PDF' | 'MALWARE' };

const READ_CHUNK_LIMIT = 1024 * 1024;

@Injectable()
export class PackageDocumentScanner {
  constructor(private readonly config: ConfigService) {}

  async scan(
    input: PackageDocumentScanInput,
  ): Promise<PackageDocumentScanResult> {
    const content = await readExactContent(input.stream, input.contentLength);
    const signatureResult = validateSignature(input.contentType, content);
    if (!signatureResult.safe) {
      return signatureResult;
    }

    const mode = (this.config.get<string>('FILE_SCAN_MODE') ?? 'signature')
      .trim()
      .toLowerCase();
    if (mode === 'signature') {
      return { safe: true };
    }
    if (mode !== 'clamav') {
      throw new PackageDocumentScanUnavailableError();
    }

    return (await scanWithClamAv(content, {
      host: this.config.get<string>('CLAMAV_HOST')?.trim() ?? '',
      port: parsePositiveInteger(this.config.get<string>('CLAMAV_PORT'), 3310),
      timeoutMs: parsePositiveInteger(
        this.config.get<string>('CLAMAV_TIMEOUT_MS'),
        10_000,
      ),
    }))
      ? { safe: true }
      : { safe: false, reason: 'MALWARE' };
  }
}

async function readExactContent(
  stream: Readable,
  expectedLength: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;

  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.length;
      if (received > expectedLength) {
        throw new PackageDocumentScanUnavailableError();
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof PackageDocumentScanUnavailableError) {
      throw error;
    }
    throw new PackageDocumentScanUnavailableError();
  }

  if (received !== expectedLength) {
    throw new PackageDocumentScanUnavailableError();
  }
  return Buffer.concat(chunks, received);
}

function validateSignature(
  contentType: string,
  content: Buffer,
): PackageDocumentScanResult {
  if (contentType === 'application/pdf') {
    if (!content.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return { safe: false, reason: 'INVALID_SIGNATURE' };
    }
    if (/\/Encrypt\b/.test(content.toString('latin1'))) {
      return { safe: false, reason: 'ENCRYPTED_PDF' };
    }
    return { safe: true };
  }

  if (contentType === 'image/jpeg') {
    return content.length >= 3 &&
      content[0] === 0xff &&
      content[1] === 0xd8 &&
      content[2] === 0xff
      ? { safe: true }
      : { safe: false, reason: 'INVALID_SIGNATURE' };
  }

  if (contentType === 'image/png') {
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    return content.subarray(0, pngSignature.length).equals(pngSignature)
      ? { safe: true }
      : { safe: false, reason: 'INVALID_SIGNATURE' };
  }

  if (contentType === 'image/webp') {
    return content.subarray(0, 4).toString('ascii') === 'RIFF' &&
      content.subarray(8, 12).toString('ascii') === 'WEBP'
      ? { safe: true }
      : { safe: false, reason: 'INVALID_SIGNATURE' };
  }

  return { safe: false, reason: 'INVALID_SIGNATURE' };
}

async function scanWithClamAv(
  content: Buffer,
  config: { host: string; port: number; timeoutMs: number },
): Promise<boolean> {
  if (!config.host) {
    throw new PackageDocumentScanUnavailableError();
  }

  return new Promise<boolean>((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port });
    let response = '';
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback();
    };

    socket.setTimeout(config.timeoutMs);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (
        let offset = 0;
        offset < content.length;
        offset += READ_CHUNK_LIMIT
      ) {
        const chunk = content.subarray(offset, offset + READ_CHUNK_LIMIT);
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (!response.includes('\0')) return;
      finish(() => {
        const normalized = response.replaceAll('\0', '').trim();
        if (normalized.endsWith('OK')) resolve(true);
        else if (normalized.includes('FOUND')) resolve(false);
        else reject(new PackageDocumentScanUnavailableError());
      });
    });
    socket.on('timeout', () =>
      finish(() => reject(new PackageDocumentScanUnavailableError())),
    );
    socket.on('error', () =>
      finish(() => reject(new PackageDocumentScanUnavailableError())),
    );
    socket.on('end', () => {
      if (!settled) {
        finish(() => reject(new PackageDocumentScanUnavailableError()));
      }
    });
  });
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
