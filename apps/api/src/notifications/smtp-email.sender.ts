import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class SmtpEmailSender {
  constructor(private readonly config: ConfigService) {}

  async checkHealth(): Promise<boolean> {
    if (!this.text('SMTP_HOST') || !this.text('SMTP_FROM')) return false;
    try {
      await this.createTransport().verify();
      return true;
    } catch {
      return false;
    }
  }

  async send(input: { to: string; subject: string; body: string }) {
    const from = this.text('SMTP_FROM');
    if (!from) throw new Error('SMTP_NOT_CONFIGURED');

    const result = await this.createTransport().sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return { messageId: result.messageId };
  }

  private createTransport() {
    const host = this.text('SMTP_HOST');
    if (!host) throw new Error('SMTP_NOT_CONFIGURED');
    const user = this.text('SMTP_USER');
    const pass = this.text('SMTP_PASSWORD');
    return nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 1025),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  private text(name: string): string | null {
    const value = this.config.get<string>(name)?.trim();
    return value || null;
  }
}
