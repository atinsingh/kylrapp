import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface Mail { to: string; subject: string; text: string }
export interface Mailer { send(mail: Mail): Promise<void> }
export const MAILER = Symbol('MAILER');

/** SES SMTP in AWS, Mailpit locally. */
export class SmtpMailer implements Mailer {
  private readonly transport;
  constructor(url: string) { this.transport = nodemailer.createTransport(url); }
  async send(m: Mail) { await this.transport.sendMail({ from: config.mailFrom, ...m }); }
}

/** Development fallback when no SMTP server is configured: prints the email to the log. */
export class ConsoleMailer implements Mailer {
  private readonly log = new Logger('Mail');
  async send(m: Mail) { this.log.log(`to ${m.to} · ${m.subject}\n${m.text}`); }
}

export function createMailer(): Mailer {
  if (config.smtpUrl) return new SmtpMailer(config.smtpUrl);
  if (config.production) throw new Error('SMTP_URL is required in production');
  return new ConsoleMailer();
}
