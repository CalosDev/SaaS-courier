import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';

import { PackageDocumentScanUnavailableError } from './package-document.errors';
import { PackageDocumentScanner } from './package-document-scanner';

describe('PackageDocumentScanner', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'FILE_SCAN_MODE' ? 'signature' : undefined,
    ),
  } as unknown as ConfigService;
  const scanner = new PackageDocumentScanner(config);

  beforeEach(() => jest.clearAllMocks());

  it('accepts a PDF with a valid signature', async () => {
    const content = Buffer.from('%PDF-1.7\n%%EOF');

    await expect(
      scanner.scan({
        contentType: 'application/pdf',
        contentLength: content.length,
        stream: Readable.from(content),
      }),
    ).resolves.toEqual({ safe: true });
  });

  it('rejects content whose bytes do not match the declared MIME type', async () => {
    const content = Buffer.from('not a png');

    await expect(
      scanner.scan({
        contentType: 'image/png',
        contentLength: content.length,
        stream: Readable.from(content),
      }),
    ).resolves.toEqual({ safe: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects encrypted PDFs', async () => {
    const content = Buffer.from('%PDF-1.7\n1 0 obj <</Encrypt 2 0 R>>');

    await expect(
      scanner.scan({
        contentType: 'application/pdf',
        contentLength: content.length,
        stream: Readable.from(content),
      }),
    ).resolves.toEqual({ safe: false, reason: 'ENCRYPTED_PDF' });
  });

  it('fails closed when the scan mode is invalid', async () => {
    const invalidConfig = {
      get: jest.fn((key: string) =>
        key === 'FILE_SCAN_MODE' ? 'disabled' : undefined,
      ),
    } as unknown as ConfigService;
    const invalidScanner = new PackageDocumentScanner(invalidConfig);
    const content = Buffer.from('%PDF-1.7\n%%EOF');

    await expect(
      invalidScanner.scan({
        contentType: 'application/pdf',
        contentLength: content.length,
        stream: Readable.from(content),
      }),
    ).rejects.toBeInstanceOf(PackageDocumentScanUnavailableError);
  });

  it('fails closed when the object length changes during scanning', async () => {
    const content = Buffer.from('%PDF-1.7\n%%EOF');

    await expect(
      scanner.scan({
        contentType: 'application/pdf',
        contentLength: content.length + 1,
        stream: Readable.from(content),
      }),
    ).rejects.toBeInstanceOf(PackageDocumentScanUnavailableError);
  });
});
