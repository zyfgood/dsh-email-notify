/**
 * 邮件收取：基于 imapflow + mailparser 的 IMAP 拉取与解析。
 *
 * 凭证与 SMTP 复用（网易系授权码对 SMTP/IMAP 同时有效）；IMAP 服务器
 * 默认从 SMTP host 推导（smtp.xxx → imap.xxx），可用 imapHost 显式覆盖。
 *
 * @module dsh-email-notify/receive
 */

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { EmailConfig } from './mail.ts'

/** 一次收取的请求选项。 */
export interface ImapOptions {
  /** 邮箱目录（默认取 config.mailbox，再默认 INBOX）。 */
  mailbox?: string
  /** 拉取封数（1-10，默认 3，取最新的 N 封）。 */
  limit?: number
  /** 只取未读邮件（默认 false）。 */
  unseenOnly?: boolean
  /** 取回后标记为已读（默认 false，不改邮箱状态）。 */
  markRead?: boolean
  /** 每封正文保留的最大字符数（200-8000，默认 2500）。 */
  maxChars?: number
}

/** 一封已解析邮件。 */
export interface FetchedEmail {
  uid: number
  seq: number
  date: string
  from: string
  to: string
  subject: string
  unseen: boolean
  text: string
  truncated: boolean
  attachments: string[]
}

/** 收取结果。 */
export interface ReceiveResult {
  mailbox: string
  /** 邮箱总邮件数。 */
  total: number
  /** 按时间从新到旧排列。 */
  emails: FetchedEmail[]
}

/** 从 SMTP 服务器推导 IMAP 服务器（imapHost 显式配置优先）。 */
export function deriveImapHost(smtpHost: string, explicit?: string): string {
  const value = explicit?.trim()
  if (value) return value
  if (/^smtp\./i.test(smtpHost)) return smtpHost.replace(/^smtp\./i, 'imap.')
  if (/^imap\./i.test(smtpHost)) return smtpHost
  return `imap.${smtpHost}`
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** flags 在 imapflow 不同版本下可能是数组或 Set，做兼容判断。 */
function hasSeenFlag(flags: unknown): boolean {
  const f = flags as { includes?: (s: string) => boolean; has?: (s: string) => boolean } | undefined
  return f?.includes?.('\\Seen') ?? f?.has?.('\\Seen') ?? false
}

/** 把 mailparser/imapflow 的地址对象（可能是数组/分组）压成可读文本。 */
function addrText(value: unknown): string {
  if (!value) return ''
  const list = Array.isArray(value) ? value : [value]
  return list
    .map((item) => {
      const o = item as { text?: string; address?: string; group?: unknown } | undefined
      if (!o) return ''
      if (typeof o.text === 'string' && o.text) return o.text
      if (o.group) return addrText(o.group)
      return o.address ?? ''
    })
    .filter(Boolean)
    .join(', ')
}

/** 把 Date/字符串/无效值统一成 ISO 字符串（无效则原样字符串）。 */
function isoDate(value: unknown): string {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : ''
  if (typeof value === 'string' && value) {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d.toISOString() : value
  }
  return ''
}

/**
 * 从邮箱收取邮件（连接 → 打开目录 → 取最新/未读的 N 封 → 解析正文）。
 * @param config - SMTP/IMAP 共用配置（user/pass 已解析为真实值）。
 * @param options - 收取选项。
 */
export async function receiveEmails(config: EmailConfig, options: ImapOptions = {}): Promise<ReceiveResult> {
  const mailbox = options.mailbox?.trim() || config.mailbox?.trim() || 'INBOX'
  const limit = clamp(options.limit ?? 3, 1, 10)
  const maxChars = clamp(options.maxChars ?? 2500, 200, 8000)
  const client = new ImapFlow({
    host: deriveImapHost(config.host, config.imapHost),
    port: config.imapPort ?? 993,
    secure: config.imapSecure ?? true,
    auth: { user: config.user, pass: config.pass },
    // 网易系 IMAP 要求客户端上报 ID 信息，否则可能报 Unsafe Login
    clientInfo: { name: 'dsh-email-notify', version: '0.2.0' },
    logger: false,
  })
  await client.connect()
  try {
    const box = await client.mailboxOpen(mailbox)
    const total = box.exists
    const emails: FetchedEmail[] = []
    const lock = await client.getMailboxLock(mailbox)
    try {
      let targets: number[] = []
      if (options.unseenOnly) {
        // 两阶段：先在尾部扫描区内只拉 flags（轻量），筛出未读后再取正文，
        // 避免依赖各服务器行为不一的 SEARCH 命令。
        const scanFrom = Math.max(1, total - Math.min(total, limit * 5) + 1)
        const unseens: { seq: number; uid: number }[] = []
        if (total > 0) {
          for await (const m of client.fetch(`${scanFrom}:${total}`, { uid: true, flags: true }, { uid: false })) {
            if (!hasSeenFlag(m.flags)) unseens.push({ seq: m.seq ?? 0, uid: m.uid })
          }
        }
        targets = unseens.slice(-limit).map((u) => u.seq)
      } else {
        for (let seq = Math.max(1, total - limit + 1); seq <= total; seq++) targets.push(seq)
      }
      if (targets.length > 0) {
        for await (const msg of client.fetch(targets.join(','), { uid: true, source: true, envelope: true, flags: true }, { uid: false })) {
          if (!msg.source) continue
          const parsed = await simpleParser(msg.source)
          const raw = parsed.text ?? ''
          const seen = hasSeenFlag(msg.flags)
          emails.push({
            uid: msg.uid,
            seq: msg.seq ?? 0,
            date: isoDate(parsed.date ?? msg.envelope?.date),
            from: addrText(parsed.from) || addrText(msg.envelope?.from),
            to: addrText(parsed.to) || addrText(msg.envelope?.to),
            subject: parsed.subject ?? msg.envelope?.subject ?? '',
            unseen: !seen,
            text: raw.slice(0, maxChars),
            truncated: raw.length > maxChars,
            attachments: (parsed.attachments ?? []).map((a) => `${a.filename ?? a.contentType} (${a.size}B)`),
          })
          if (options.markRead && !seen) await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
        }
      }
    } finally {
      lock.release()
    }
    emails.reverse() // 最新在前
    return { mailbox, total, emails }
  } finally {
    await client.logout()
  }
}
