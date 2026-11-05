/**
 * 邮件收取：基于 imapflow + mailparser 的 IMAP 拉取与解析。
 *
 * 凭证与 SMTP 复用（网易系授权码对 SMTP/IMAP 同时有效）；IMAP 服务器
 * 默认从 SMTP host 推导（smtp.xxx → imap.xxx），可用 imapHost 显式覆盖。
 *
 * @module dsh-email-notify/receive
 */
import type { EmailConfig } from './mail.ts';
/** 一次收取的请求选项。 */
export interface ImapOptions {
    /** 邮箱目录（默认取 config.mailbox，再默认 INBOX）。 */
    mailbox?: string;
    /** 拉取封数（1-10，默认 3，取最新的 N 封）。 */
    limit?: number;
    /** 只取未读邮件（默认 false）。 */
    unseenOnly?: boolean;
    /** 取回后标记为已读（默认 false，不改邮箱状态）。 */
    markRead?: boolean;
    /** 每封正文保留的最大字符数（200-8000，默认 2500）。 */
    maxChars?: number;
}
/** 一封已解析邮件。 */
export interface FetchedEmail {
    uid: number;
    seq: number;
    date: string;
    from: string;
    to: string;
    subject: string;
    unseen: boolean;
    text: string;
    truncated: boolean;
    attachments: string[];
}
/** 收取结果。 */
export interface ReceiveResult {
    mailbox: string;
    /** 邮箱总邮件数。 */
    total: number;
    /** 按时间从新到旧排列。 */
    emails: FetchedEmail[];
}
/** 从 SMTP 服务器推导 IMAP 服务器（imapHost 显式配置优先）。 */
export declare function deriveImapHost(smtpHost: string, explicit?: string): string;
/**
 * 从邮箱收取邮件（连接 → 打开目录 → 取最新/未读的 N 封 → 解析正文）。
 * @param config - SMTP/IMAP 共用配置（user/pass 已解析为真实值）。
 * @param options - 收取选项。
 */
export declare function receiveEmails(config: EmailConfig, options?: ImapOptions): Promise<ReceiveResult>;
//# sourceMappingURL=receive.d.ts.map