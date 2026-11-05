#!/usr/bin/env node
/**
 * dsh-email-notify 冒烟测试：用 mock 上下文跑通核心链路。
 *
 * 覆盖：模块导出、Config 校验、env: 密钥解析、email_send/email_check 工具
 * 注册、失败路径（不可达 SMTP/IMAP）、成功路径（jsonTransport mock）与
 * 默认收件人回退、IMAP 主机推导。
 */

import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import { apply, Config, resolveSecret } from '../lib/index.js'
import { deriveImapHost } from '../lib/receive.js'

let passed = 0
const ok = (name) => { passed++; console.log(`  ✓ ${name}`) }

function makeCtx(regs) {
  return {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    effect: (fn) => fn(),
    get: (name) => (name === 'tools' ? { register: (tool) => regs.set(tool.name, tool) } : undefined),
  }
}

console.log('1) 模块导出')
assert.ok(Config, 'Config 应可导入')
assert.equal(typeof apply, 'function', 'apply 应为函数')
assert.equal(typeof resolveSecret, 'function', 'resolveSecret 应为函数')
ok('导出完整')

console.log('2) Config 校验')
const cfg = Config({ host: 'smtp.example.com', user: 'a@b.c', pass: 'pw' })
assert.equal(cfg.port, 465, 'port 默认 465')
assert.equal(cfg.secure, true, 'secure 默认 true')
ok('默认值正确')

console.log('3) env: 密钥解析')
process.env.SMOKE_SMTP_PASS = 'secret-value'
assert.equal(resolveSecret('env:SMOKE_SMTP_PASS'), 'secret-value', 'env: 引用应解析')
assert.equal(resolveSecret('plain'), 'plain', '普通值原样返回')
assert.throws(() => resolveSecret('env:SMOKE_NOT_SET_XYZ'), /未设置/, '未设置变量应报错')
ok('env: 解析与报错')

console.log('4) email_send/email_check 工具注册 + 失败路径 + 默认收件人')
{
  const regs = new Map()
  apply(makeCtx(regs), { host: '127.0.0.1', port: 1, user: 'tester@example.com', pass: 'pw', imapHost: '127.0.0.1', imapPort: 1 })
  assert.ok(regs.has('email_send'), '应注册 email_send')
  assert.ok(regs.has('email_check'), '应注册 email_check')
  const tool = regs.get('email_send')
  const r = await tool.execute({ subject: '测试', content: '正文' }, {})
  assert.equal(r.sent, false, '不可达 SMTP 应返回失败')
  assert.equal(r.to, 'tester@example.com', '未配置 to 时默认发给自己')
  const rc = await regs.get('email_check').execute({ limit: 1 }, {})
  assert.equal(rc.ok, false, '不可达 IMAP 应返回失败')
  assert.ok(rc.detail, '失败应带 detail')
  assert.equal(rc.mailbox, 'INBOX', '默认邮箱目录应为 INBOX')
}
ok('注册 + 失败路径 + 默认收件人')

console.log('4b) IMAP 主机推导')
assert.equal(deriveImapHost('smtp.yeah.net'), 'imap.yeah.net')
assert.equal(deriveImapHost('smtp.163.com'), 'imap.163.com')
assert.equal(deriveImapHost('smtp.qq.com'), 'imap.qq.com')
assert.equal(deriveImapHost('smtp.example.com', 'mail.internal.corp'), 'mail.internal.corp', '显式配置优先')
assert.equal(deriveImapHost('yeah.net'), 'imap.yeah.net', '裸域名补 imap. 前缀')
ok('IMAP 主机推导')

console.log('5) email_send 成功路径（mock jsonTransport，不连真实 SMTP）')
{
  // nodemailer 的 jsonTransport 不真正发信：把 createTransport 换成它，即可无网络验证成功链路。
  const realCreateTransport = nodemailer.createTransport
  nodemailer.createTransport = (opts) => realCreateTransport({ ...opts, jsonTransport: true })
  try {
    const regs = new Map()
    apply(makeCtx(regs), { host: 'smtp.example.com', user: 'sender@example.com', pass: 'pw' })
    const tool = regs.get('email_send')
    const r = await tool.execute({ subject: '成功测试', content: '正文' }, {})
    assert.equal(r.sent, true, 'jsonTransport mock 下应发送成功')
    assert.ok(r.message_id, '应返回 message_id')
    assert.equal(r.to, 'sender@example.com', '未配置 to 时默认发给自己')
    const r2 = await tool.execute({ subject: 'x', content: 'y', to: 'c@d.e, f@g.h' }, {})
    assert.equal(r2.sent, true, '显式多收件人应成功')
    assert.equal(r2.to, 'c@d.e, f@g.h', '显式 to 应优先于默认')
    const r3 = await tool.execute({ subject: 'html', content: '<b>hi</b>', html: true }, {})
    assert.equal(r3.sent, true, 'html 邮件应成功')
    assert.equal(r3.to, 'sender@example.com', 'html 场景默认收件人回退仍生效')
  } finally {
    nodemailer.createTransport = realCreateTransport
  }
}
ok('成功路径（jsonTransport mock）')

console.log(`\n全部通过（${passed} 组断言）`)
