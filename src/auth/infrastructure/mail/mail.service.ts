import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_USER', '');
    const port = Number(this.configService.get<string>('SMTP_PORT'));
    this.transporter = createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: {
        user: this.from,
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: '[Piston] 이메일 인증코드',
      text: `인증코드: ${code}\n5분 이내에 입력해주세요.`,
      html: this.buildAchievementHtml({
        subtitle: 'Email Verification',
        value: code,
        footer: '5분 이내에 입력해주세요. 요청하지 않았다면 무시해도 됩니다.',
      }),
    });
  }

  async sendIdRecovery(email: string, loginId: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: '[Piston] 아이디 찾기',
      text: `회원님의 아이디: ${loginId}`,
      html: this.buildAchievementHtml({
        subtitle: 'Find ID',
        value: loginId,
        footer: '본인이 요청하지 않았다면 이 이메일을 무시해주세요.',
      }),
    });
  }

  async sendPasswordRecovery(email: string, password: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: '[Piston] 비밀번호 찾기',
      text: `회원님의 비밀번호: ${password}`,
      html: this.buildAchievementHtml({
        subtitle: 'Find Password',
        value: password,
        footer: '본인이 요청하지 않았다면 이 이메일을 무시해주세요.',
      }),
    });
  }

  private buildAchievementHtml({
    subtitle,
    value,
    footer,
  }: {
    subtitle: string;
    value: string;
    footer: string;
  }): string {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1E1E1E;padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="border:6px solid #000000;">
              <tr>
                <td style="border:6px solid #C6C6C6;background:#313131;padding:0;">

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:20px 24px 16px;" align="left">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="28" height="28" style="width:28px;height:28px;">
                              <div style="width:28px;height:11px;background:#6AA84F;border:2px solid #000000;border-bottom:none;"></div>
                              <div style="width:28px;height:11px;background:#8B5A2B;border:2px solid #000000;border-top:none;"></div>
                            </td>
                            <td style="padding-left:12px;" valign="middle">
                              <p style="margin:0;font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:#FFD700;text-shadow:1px 1px 0 #000000;">
                                ACHIEVEMENT GET!
                              </p>
                              <p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:12px;color:#FFFFFF;">
                                Piston &middot; ${subtitle}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 24px 24px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:4px solid #000000;">
                          <tr>
                            <td style="border:4px solid #4A4A4A;background:#000000;padding:22px 12px;text-align:center;">
                              <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#55FFFF;text-shadow:2px 2px 0 #00575A;">
                                ${value}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 24px 22px;">
                        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;color:#AAAAAA;">
                          &gt; ${footer}
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }
}
