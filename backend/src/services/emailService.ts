/**
 * Email Service for Edu-Analyst AI
 * Handles sending transactional emails via SMTP
 */

import nodemailer from 'nodemailer';
import { config } from '../config.js';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    console.warn('SMTP not configured - emails will not be sent');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });
  }

  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    console.log('Email not sent (SMTP not configured):', {
      to: options.to,
      subject: options.subject,
    });
    // In development, log the email content
    if (config.nodeEnv === 'development') {
      console.log('Email content:', options.text);
    }
    return false;
  }

  try {
    await transport.sendMail({
      from: config.smtpFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
): Promise<boolean> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  const subject = 'Reset Your Password - Edu-Analyst AI';

  const text = `
Hello${userName ? ` ${userName}` : ''},

You requested to reset your password for your Edu-Analyst AI account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The Edu-Analyst AI Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Edu-Analyst AI</h1>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>

    <p>Hello${userName ? ` <strong>${userName}</strong>` : ''},</p>

    <p>You requested to reset your password for your Edu-Analyst AI account.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e1e5e9; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">The Edu-Analyst AI Team</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}
