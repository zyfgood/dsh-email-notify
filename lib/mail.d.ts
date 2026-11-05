/**
 * 邮件通知：基于 nodemailer 的 SMTP 发送（SSL + 465 端口约定）。
 *
 * 凭证来自插件 config（user/pass 支持 `env:VAR` 引用）。
 *
 * @module dsh-email-notify/mail
 */
/** SMTP 邮件配置。 */
export interface EmailConfig {
    /** SMTP 服务器（如 smtp.163.com）。 */
    host: string;
    /** SMTP 端口（默认 465，SSL）。 */
    port?: number;
    /** 是否 SSL（端口 465 为 true，587 为 false；默认 true）。 */
    secure?: boolean;
    /** 发件账号（支持 `env:VAR`，解析后传入）。 */
    user: string;
    /** 发件凭证/授权码（支持 `env:VAR`，解析后传入）。 */
    pass: string;
    /** 默认收件人（多个用逗号分隔；不配置则发给自己）。 */
    to?: string;
    /** IMAP 服务器（收取用；不配置则从 host 推导 smtp.* → imap.*）。 */
    imapHost?: string;
    /** IMAP 端口（默认 993，SSL）。 */
    imapPort?: number;
    /** IMAP 是否 SSL（默认 true）。 */
    imapSecure?: boolean;
    /** 默认邮箱目录（默认 INBOX）。 */
    mailbox?: string;
}
/** 一次发送的结果。 */
export interface EmailSendResult {
    /** nodemailer 的消息 id（服务端 Message-ID 头）。 */
    messageId?: string;
    /** 实际接受的收件人列表。 */
    accepted?: string[];
}
/**
 * 发送一封邮件。
 * @param config - SMTP 配置（user/pass 已解析为真实值）。
 * @param to - 收件人（逗号分隔多个）。
 * @param subject - 主题。
 * @param content - 正文（text 或 html）。
 * @param html - content 是否按 HTML 发送。
 */
export declare function sendEmail(config: EmailConfig, to: string, subject: string, content: string, html: boolean): Promise<EmailSendResult>;
//# sourceMappingURL=mail.d.ts.map