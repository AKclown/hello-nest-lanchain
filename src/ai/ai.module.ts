import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { UserService } from './user.service';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { MailerService } from '@nestjs-modules/mailer';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    UserService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        return new ChatOpenAI({
          model: configService.get('MODEL_NAME'),
          apiKey: configService.get('OPENAI_API_KEY'),
          configuration: {
            baseURL: configService.get('OPENAI_BASE_URL'),
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'QUERY_USER_TOOL',
      useFactory: (userService: UserService) => {
        const queryUserArgsSchema = z.object({
          userId: z.string().describe('用户 ID，例如: 001, 002, 003'),
        });

        return tool(
          async ({ userId }: { userId: string }) => {
            const user = userService.findOne(userId);

            if (!user) {
              const availableIds = userService
                .findAll()
                .map((u) => u.id)
                .join(', ');

              return `用户 ID ${userId} 不存在。可用的 ID: ${availableIds}`;
            }

            return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
          },
          {
            name: 'query_user',
            description:
              '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
            schema: queryUserArgsSchema,
          },
        );
      },
      inject: [UserService],
    },
    {
      provide: 'SEND_MAIL_TOOL',
      useFactory: (
        configService: ConfigService,
        mailerService: MailerService,
      ) => {
        const sendMailArgsSchema = z.object({
          to: z.email().describe('收件邮箱地址，例如: someone@example.com'),
          subject: z.string().describe('邮箱主题'),
          text: z.string().optional().describe('纯文本内容，可选'),
          html: z.string().optional().describe('HTML内容 可选'),
        });

        return tool(
          async ({ to, subject, text, html }) => {
            console.log('to, subject, text, html: ', to, subject, text, html);
            try {
              const fallbackFrom = configService.get<string>('MAIL_FROM');
              await mailerService.sendMail({
                from: fallbackFrom,
                to,
                text: text ?? '(无文本内容)',
                subject,
                html: html ?? `<p>${text ?? '(无文本内容)'}</p>`,
              });
            } catch (error) {
              console.error('error: ', error);
            }
            console.log('发送完成');
            return `邮件已发送到${to}，主题为「${subject}」`;
          },
          {
            name: 'send_mail',
            description:
              '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
            schema: sendMailArgsSchema,
          },
        );
      },
      inject: [ConfigService, MailerService],
    },
    {
      provide: 'WEB_SEARCH_TOOL',
      useFactory: (configService: ConfigService) => {
        const webSearchArgsSchema = z.object({
          query: z
            .string()
            .min(1)
            .describe('搜索关键字，例如：公司年报，某个事件等'),
          count: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe('返回搜索结果数量，默认20条'),
        });

        return tool(
          async ({ query, count }) => {
            const apiKey = configService.get<string>('BOCHA_API_KEY');
            if (!apiKey) {
              return '请先配置bocha的api key连接';
            }

            const url = 'https://api.bocha.cn/v1/web-search';

            const body = {
              query,
              freshness: 'noLimit',
              summary: true,
              count: count ?? 10,
            };

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              const errorText = await response.text();
              return `搜索 API 请求失败，状态码: ${response.status}，错误信息: ${errorText}`;
            }

            let json: any;
            try {
              json = await response.json();
            } catch (e) {
              return `搜索 API 请求失败，原因是: 搜索结果解析失败 ${(e as Error).message}`;
            }

            try {
              if (json.code !== 200 || !json.data) {
                return `搜索 API 请求失败，原因是: ${json.msg ?? '未知错误'}`;
              }

              const webpages = json.data.webPages?.value ?? [];
              if (!webpages.length) {
                return '未找到相关结果。';
              }

              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              const formatted = webpages
                .map(
                  (page: Record<string, any>, idx: number) =>
                    `引用: ${idx + 1}
标题: ${page.name}
链接: ${page.url}
摘要: ${page.summary}
站点名称: ${page.siteName}
站点图标: ${page.siteIcon}
更新时间: ${page.dateLastCrawled}`,
                )
                .join('\n\n');

              return formatted;
            } catch (e) {
              return `搜索 API 请求失败，原因是: 搜索结果解析失败 ${(e as Error).message}`;
            }
          },

          {
            name: 'web_search',
            description:
              '使用BOcha web search搜索互联网网页，输入为搜搜关键字(可选count指定结果数据)，返回包含标题、URL、摘要、网站名称、图标和时间等信息结果列表',
            schema: webSearchArgsSchema,
          },
        );
      },
      inject: [ConfigService],
    },
  ],
})
export class AiModule {}
