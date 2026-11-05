/**
 * 模型可调用的工具：email_send（邮件通知）、email_check（邮件收取）。
 *
 * 依赖 `ctx.tools`；未加载该服务时跳过注册并告警。
 *
 * @module dsh-email-notify/tools
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { sendEmail } from "./mail.js";
import { receiveEmails } from "./receive.js";
/** 注册邮件发送工具。 */
export function registerEmailTool(ctx, email) {
    const tools = ctx.get('tools');
    if (!tools) {
        ctx.logger.warn('email: 当前环境未加载 ctx.tools，跳过 email_send 工具注册');
        return;
    }
    ctx.effect(() => tools.register(defineTool({
        name: 'email_send',
        description: '发送一封邮件通知（SMTP）。收件人默认为配置的默认收件人（未配置则发给自己）。适合任务结果汇报、定时任务通知、需要邮件留痕的场景。',
        parameters: {
            subject: { type: 'string', required: true, description: '邮件主题' },
            content: { type: 'string', required: true, description: '邮件正文' },
            to: { type: 'string', description: '收件人邮箱（多个用逗号分隔；不填用默认收件人）' },
            html: { type: 'boolean', description: 'content 是否按 HTML 发送（默认 false 纯文本）' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    sent: { type: 'boolean', required: true },
                    to: { type: 'string', required: true },
                    message_id: { type: 'string' },
                    detail: { type: 'string' },
                },
            },
            render: (args, value) => [{
                    type: 'text',
                    text: value.sent
                        ? `邮件已发送至 ${value.to}（message_id: ${value.message_id ?? 'n/a'}）`
                        : `邮件发送失败：${value.detail ?? '未知错误'}`,
                }],
        },
        execute: async (args) => {
            const to = args.to?.trim() || email.to?.trim() || email.user;
            try {
                const result = await sendEmail(email, to, args.subject, args.content, args.html ?? false);
                return { sent: true, to, message_id: result.messageId };
            }
            catch (error) {
                return { sent: false, to, detail: error instanceof Error ? error.message : String(error) };
            }
        },
    })));
}
/** 单封邮件在 render 文本里展示的正文字符数。 */
const renderChars = 400;
function renderEmail(email, index) {
    const head = `[${index + 1}] ${email.unseen ? '未读 ' : ''}${email.date}｜${email.from}｜${email.subject || '(无主题)'}`;
    const attach = email.attachments.length > 0 ? `\n附件: ${email.attachments.join('; ')}` : '';
    const body = email.text.replace(/\s+/g, ' ').slice(0, renderChars);
    return `${head}${attach}\n${body}${email.text.length > renderChars ? '…' : ''}`;
}
/** 注册邮件收取工具。 */
export function registerEmailCheckTool(ctx, email) {
    const tools = ctx.get('tools');
    if (!tools) {
        ctx.logger.warn('email: 当前环境未加载 ctx.tools，跳过 email_check 工具注册');
        return;
    }
    ctx.effect(() => tools.register(defineTool({
        name: 'email_check',
        description: '通过 IMAP 从发件邮箱收取邮件：返回最新或未读邮件的发件人、主题与正文摘要。适合需要阅读、汇总、转发收件邮件的场景（与 email_send 共用凭证）。',
        parameters: {
            limit: { type: 'number', description: '拉取封数（1-10，默认 3，取最新的 N 封）' },
            unseen_only: { type: 'boolean', description: '只拉未读邮件（默认 false）' },
            mailbox: { type: 'string', description: '邮箱目录（默认 INBOX）' },
            mark_read: { type: 'boolean', description: '拉取后标记为已读（默认 false）' },
            max_chars: { type: 'number', description: '每封正文保留的最大字符数（200-8000，默认 2500）' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    ok: { type: 'boolean', required: true },
                    mailbox: { type: 'string', required: true },
                    total: { type: 'number', required: true },
                    emails: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                uid: { type: 'number', required: true },
                                date: { type: 'string', required: true },
                                from: { type: 'string', required: true },
                                to: { type: 'string', required: true },
                                subject: { type: 'string', required: true },
                                unseen: { type: 'boolean', required: true },
                                text: { type: 'string', required: true },
                                truncated: { type: 'boolean', required: true },
                                attachments: { type: 'array', required: true, items: { type: 'string' } },
                            },
                        },
                    },
                    detail: { type: 'string' },
                },
            },
            render: (args, value) => [{
                    type: 'text',
                    text: value.ok
                        ? `邮箱 ${value.mailbox}（共 ${value.total} 封，返回 ${value.emails.length} 封，按新到旧）：\n\n${value.emails.map(renderEmail).join('\n\n')}`
                        : `邮件收取失败：${value.detail ?? '未知错误'}`,
                }],
        },
        execute: async (args) => {
            try {
                const result = await receiveEmails(email, {
                    mailbox: args.mailbox,
                    limit: args.limit,
                    unseenOnly: args.unseen_only,
                    markRead: args.mark_read,
                    maxChars: args.max_chars,
                });
                return { ok: true, mailbox: result.mailbox, total: result.total, emails: result.emails };
            }
            catch (error) {
                return {
                    ok: false,
                    mailbox: args.mailbox?.trim() || email.mailbox || 'INBOX',
                    total: 0,
                    emails: [],
                    detail: error instanceof Error ? error.message : String(error),
                };
            }
        },
    })));
}
//# sourceMappingURL=tools.js.map