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

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { registerEmailTool, registerEmailCheckTool } from './tools.ts'
import type { EmailConfig } from './mail.ts'

export const name = 'email-notify'

export type Config = EmailConfig

export const Config: z<Config> = z.object({
  host: z.string().required().description('SMTP 服务器（如 smtp.163.com）'),
  port: z.number().default(465),
  secure: z.boolean().default(true),
  user: z.string().required().description('发件账号，支持 env:VAR'),
  pass: z.string().required().description('发件凭证/授权码，支持 env:VAR'),
  to: z.string().description('默认收件人（不配置则发给自己）'),
  imapHost: z.string().description('IMAP 服务器（默认从 host 推导 smtp.* → imap.*）'),
  imapPort: z.number().default(993),
  imapSecure: z.boolean().default(true),
  mailbox: z.string().description('默认邮箱目录（默认 INBOX）'),
})

/** 把 `env:VAR` 形式的配置值解析为环境变量值。 */
export function resolveSecret(raw: string): string {
  if (raw.startsWith('env:')) {
    const name = raw.slice(4)
    const value = process.env[name]
    if (value === undefined) {
      throw new Error(`email-notify: 环境变量 ${name} 未设置（配置项使用了 env: 引用）`)
    }
    return value
  }
  return raw
}

export function apply(ctx: Context, config: Config): void {
  const resolved: Config = {
    ...config,
    user: resolveSecret(config.user),
    pass: resolveSecret(config.pass),
  }
  registerEmailTool(ctx, resolved)
  registerEmailCheckTool(ctx, resolved)
  ctx.logger.info(
    `email: 邮件收发已启用（SMTP ${config.host}:${config.port ?? 465}，IMAP ${resolved.imapHost ?? config.host.replace(/^smtp\./i, 'imap.')}:${config.imapPort ?? 993}，账号 ${resolved.user.slice(0, 3)}***）`,
  )
}
