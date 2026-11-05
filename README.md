# @zyfgood/dsh-email-notify

DeepSeek Harness 邮件插件：注册 `email_send`（发信）与 `email_check`（收信）
两个模型工具，让 agent 发送任务结果/通知邮件、阅读/汇总收件邮件。
凭证（`user`/`pass`，邮箱「授权码」）SMTP 与 IMAP 共用；IMAP 主机默认从
`host` 推导（`smtp.yeah.net` → `imap.yeah.net:993`），可用 `imapHost` 覆盖。

> 从 dsh-feishu-bot v0.3.0 的邮件功能隔离而来（2026-08 起，公开的飞书
> 插件 v0.4.0+ 不再包含邮件能力）。

## 模型工具

- `email_send`：发送邮件。参数 `subject`、`content`、`to`（默认取配置，
  未配置则发给 `SMTP_USER` 自己）、`html`。
- `email_check`：通过 IMAP 收取邮件。参数 `limit`（1-10，默认 3，最新 N 封）、
  `unseen_only`、`mailbox`（默认 INBOX）、`mark_read`、`max_chars`（每封正文
  200-8000，默认 2500）。返回发件人/主题/正文摘要与附件名，按新到旧排列。
  未读模式走「先扫 flags 再取正文」两阶段，不依赖各服务器行为不一的 SEARCH。

## 安装（bundle 形态，一条命令）

```bash
dsh plugin --profile <name> add @zyfgood/dsh-email-notify
```

CLI 会把本包加入 profile 的 bundle 栈；随包 `cordis.patch.yml` 自动注入
email-notify 插件行（`package.json` 声明了 `dsh.bundle.patch`），重启 DSH 生效。

## 配置

1. `~/.dsh/.env`（Windows：`%USERPROFILE%/.dsh/.env`）写入凭证，`loadLayeredEnv`
   启动注入，密钥不写进任何配置文件：

   ```ini
   SMTP_USER=you@example.com
   SMTP_PASS=SMTP授权码    # 非登录密码；网易/QQ 邮箱的「授权码」对 SMTP/IMAP 同时有效
   ```

2. SMTP 服务器按发件域名在随包 patch 中配置（默认 `smtp.yeah.net:465`）：

   | 发件域 | host |
   |---|---|
   | yeah.net | smtp.yeah.net |
   | 163.com | smtp.163.com |
   | 126.com | smtp.126.com |
   | qq.com / foxmail.com | smtp.qq.com |
   | 其他 | `smtp.<域名>` 兜底 |

3. 非网易邮箱或要加默认收件人：在 profile 自己的 `cordis.patch.yml` 里按
   `id: email-notify` 覆盖（profile patch 在 bundle patch 之后合并；config
   为整键替换，覆盖时请带上全部键）：

   ```yaml
   - id: email-notify
     name: '@zyfgood/dsh-email-notify'
     config:
       host: smtp.qq.com      # IMAP 自动推导为 imap.qq.com
       port: 465
       secure: true
       user: 'env:SMTP_USER'
       pass: 'env:SMTP_PASS'
       to: someone@example.com  # 可选，默认收件人
   ```

## 开发

```bash
npm run build   # tsc → lib/
npm test        # tests/smoke.mjs 冒烟测试（mock，不联网）
node tests/send-live.mjs [收件人]      # 真实 SMTP 发送冒烟（读 ~/.dsh/.env）
node tests/receive-live.mjs 3 [--unseen] [--mark-read]   # 真实 IMAP 收取冒烟
```

## License

MIT
