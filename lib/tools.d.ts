/**
 * 模型可调用的工具：email_send（邮件通知）、email_check（邮件收取）。
 *
 * 依赖 `ctx.tools`；未加载该服务时跳过注册并告警。
 *
 * @module dsh-email-notify/tools
 */
import type { Context } from '@deepseek-ai/cordis';
import { type EmailConfig } from './mail.ts';
/** 注册邮件发送工具。 */
export declare function registerEmailTool(ctx: Context, email: EmailConfig): void;
/** 注册邮件收取工具。 */
export declare function registerEmailCheckTool(ctx: Context, email: EmailConfig): void;
//# sourceMappingURL=tools.d.ts.map