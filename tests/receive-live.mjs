#!/usr/bin/env node
/**
 * dsh-email-notify 真实收取测试（直连 IMAP，不经 DSH）。
 *
 * 凭证读取 ~/.dsh/.env 的 SMTP_USER/SMTP_PASS，IMAP 主机自动推导。
 *
 * 用法：
 *   node tests/receive-live.mjs [limit] [--unseen] [--mark-read] [--mailbox=INBOX]
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { receiveEmails, deriveImapHost } from '../lib/receive.js'

function loadDotEnv() {
  const file = path.join(os.homedir(), '.dsh', '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const value = m[2].trim().replace(/^['"]|['"]$/g, '')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}
loadDotEnv()
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
if (!user || !pass) {
  console.error('缺少 SMTP_USER / SMTP_PASS（进程环境变量或 ~/.dsh/.env）')
  process.exit(1)
}

/** 按发件域名推断 SMTP 服务器（网易系 / QQ，其余按 smtp.<domain> 兜底）。 */
function smtpHostFor(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  const map = {
    'yeah.net': 'smtp.yeah.net',
    '163.com': 'smtp.163.com',
    '126.com': 'smtp.126.com',
    'qq.com': 'smtp.qq.com',
    'foxmail.com': 'smtp.qq.com',
  }
  return map[domain] ?? `smtp.${domain}`
}

const args = process.argv.slice(2)
const limit = Number(args.find((a) => !a.startsWith('--')) ?? 3)
const mailbox = args.find((a) => a.startsWith('--mailbox='))?.slice('--mailbox='.length) || 'INBOX'
const config = { host: process.env.SMTP_HOST ?? smtpHostFor(user), user, pass }
const imapHost = deriveImapHost(config.host)

console.log(`账号 ${user} 邮箱 ${mailbox}（${imapHost}:993 SSL）limit=${limit} unseenOnly=${args.includes('--unseen')}`)
const started = Date.now()
try {
  const result = await receiveEmails(config, {
    mailbox,
    limit,
    unseenOnly: args.includes('--unseen'),
    markRead: args.includes('--mark-read'),
  })
  console.log(`✅ 收取成功（${Date.now() - started}ms）邮箱共 ${result.total} 封，返回 ${result.emails.length} 封：`)
  for (const email of result.emails) {
    console.log('─'.repeat(60))
    console.log(`uid=${email.uid} ${email.unseen ? '[未读]' : '[已读]'} ${email.date}`)
    console.log(`from: ${email.from}\nto:   ${email.to}\nsubj: ${email.subject}`)
    if (email.attachments.length) console.log(`附件: ${email.attachments.join('; ')}`)
    console.log(email.text.replace(/\s+/g, ' ').slice(0, 300) + (email.truncated ? '…' : ''))
  }
} catch (error) {
  console.error(`❌ 收取失败（${Date.now() - started}ms）：${error?.message ?? error}`)
  process.exit(2)
}
