#!/usr/bin/env node
/**
 * dsh-email-notify 真实发信测试（直连 SMTP，不经 DSH）。
 *
 * 凭证读取顺序：进程环境变量 SMTP_USER/SMTP_PASS 优先，
 * 其次解析 ~/.dsh/.env。脚本不打印任何凭证。
 *
 * 用法：
 *   node tests/send-live.mjs [收件人] [主题]
 *   默认收件人 zyfgood@yeah.net
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { sendEmail } from '../lib/mail.js'

/** 从 ~/.dsh/.env 解析键值（不覆盖已有环境变量）。 */
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

loadDotEnv()
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
if (!user || !pass) {
  console.error('缺少 SMTP_USER / SMTP_PASS（进程环境变量或 ~/.dsh/.env）')
  process.exit(1)
}

const to = process.argv[2] ?? user
const subject = process.argv[3] ?? `dsh-email-notify 直连测试 ${new Date().toLocaleString('zh-CN')}`
const host = smtpHostFor(user)
console.log(`发件 ${user} → 收件 ${to}（${host}:465 SSL）`)

const started = Date.now()
try {
  const result = await sendEmail(
    { host, port: 465, secure: true, user, pass },
    to,
    subject,
    [
      '这是一封由 dsh-email-notify 插件库直连发送的测试邮件。',
      '',
      `时间：${new Date().toString()}`,
      `发件：${user}`,
      `SMTP：${host}:465 (SSL)`,
      '',
      '收到即表示 SMTP 凭证与网络通路正常，可以进行插件正式接入。',
    ].join('\n'),
    false,
  )
  console.log(`✅ 发送成功（${Date.now() - started}ms）`)
  console.log(`   message_id: ${result.messageId}`)
  console.log(`   accepted:   ${JSON.stringify(result.accepted)}`)
} catch (error) {
  console.error(`❌ 发送失败（${Date.now() - started}ms）：${error?.message ?? error}`)
  if (error?.code) console.error(`   code: ${error.code}`)
  if (error?.response) console.error(`   smtp response: ${error.response}`)
  process.exit(2)
}
