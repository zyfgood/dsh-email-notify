/**
 * dsh-email-notify — DeepSeek Harness 邮件插件（@zyfgood/dsh-email-notify）。
 *
 * 功能：配置 SMTP/IMAP 凭证后注册 `email_send`（发信）与 `email_check`
 * （收信）两个模型工具，让 DSH agent 主动发送通知邮件、阅读/汇总收件
 * 邮件。从 dsh-feishu-bot v0.3.0 的邮件功能隔离而来（公开的飞书插件
 * 不再包含邮件能力）。
 *
 * 加载方式（bundle 形态，见随包 cordis.patch.yml）：
 * ```yaml
 * - insert:
 *     - id: email-notify
 *       name: '@zyfgood/dsh-email-notify'
 *       config:
 *         host: smtp.yeah.net      # SMTP；IMAP 自动推导为 imap.yeah.net
 *         user: 'env:SMTP_USER'
 *         pass: 'env:SMTP_PASS'
 *         to: someone@example.com  # 可选，默认发给自己
 * ```
 *
 * @module dsh-email-notify
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { EmailConfig } from './mail.ts';
export declare const name = "email-notify";
export type Config = EmailConfig;
export declare const Config: z<Config>;
/** 把 `env:VAR` 形式的配置值解析为环境变量值。 */
export declare function resolveSecret(raw: string): string;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map