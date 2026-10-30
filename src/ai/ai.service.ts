import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

import { z } from 'zod';

import { tool } from '@langchain/core/tools';
import { AIMessageChunk } from '@langchain/core/messages';

/**
 * 下面是最初版本的内联工具定义，只是保留做参考，不再实际使用。
 *
 * const database = {
 *   users: {
 *     '001': { id: '001', name: '张三', email: 'zhangsan@example.com', role: 'admin' },
 *     '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
 *     '003': { id: '003', name: '王五', email: 'wangwu@example.com', role: 'user' },
 *   },
 * };
 *
 * const queryUserArgsSchema = z.object({
 *   userId: z.string().describe('用户 ID，例如: 001, 002, 003'),
 * });
 *
 * type QueryUserArgs = {
 *   userId: string;
 * };
 *
 * const queryUserTool = tool(
 *   async ({ userId }: QueryUserArgs) => {
 *     const user = database.users[userId];
 *
 *     if (!user) {
 *       return `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`;
 *     }
 *
 *     return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
 *   },
 *   {
 *     name: 'query_user',
 *     description:
 *       '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
 *     schema: queryUserArgsSchema,
 *   },
 * );
 */

const database = {
  users: {
    '001': {
      id: '001',
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'admin',
    },
    '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
    '003': {
      id: '003',
      name: '王五',
      email: 'wangwu@example.com',
      role: 'user',
    },
  },
};

// const queryUserArgsSchema = z.object({
//   userId: z.string().describe('用户 ID，例如: 001, 002, 003'),
// });

// type QueryUserArgs = {
//   userId: string;
// };

// const queryUserTool = tool(
//   ({ userId }: QueryUserArgs) => {
//     const user = database.users[userId] as Record<string, string>;
//     if (!user) {
//       return `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`;
//     }

//     return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
//   },
//   {
//     name: 'query_user',
//     description:
//       '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
//     schema: queryUserArgsSchema,
//   },
// );

@Injectable()
export class AiService {
  // private readonly chain: Runnable;

  // Runnable类型第一个为输入类型，第二个为输出类型
  private readonly modeWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    // @Inject('QUERY_USER_TOOL') private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CURD_TOOL') private readonly dbUsersCrudTool: any,
  ) {
    this.modeWithTools = model.bindTools([
      // this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
    ]);

    // $ ai
    // const prompt = PromptTemplate.fromTemplate(`请回答以下问题：\n\n{query}`);

    // this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  // async runChain(query: string): Promise<string> {
  //   // return this.chain.invoke({ query }) as Promise<string>;

  //   const messages: BaseMessage[] = [
  //     new SystemMessage(
  //       '你是一个智能助手，可以在需要时调用工具(如query_user)来查询用户信息，再用结果回答用户的问题',
  //     ),
  //     new HumanMessage(query),
  //   ];

  //   while (true) {
  //     const aiMessage = await this.modeWithTools.invoke(messages);
  //     messages.push(aiMessage);

  //     const toolCalls = aiMessage.tool_calls ?? [];

  //     if (!toolCalls.length) {
  //       return aiMessage.content as string;
  //     }

  //     // 依次执行本轮需要调用的所有工具
  //     for (const toolCall of toolCalls) {
  //       const toolCallId = toolCall.id || '';
  //       const toolName = toolCall.name;

  //       if (toolName === 'query_user') {
  //         console.log('toolCall.args: ', toolCall.args);
  //         const args = queryUserArgsSchema.parse(toolCall.args);
  //         console.log('args: ', args);
  //         const result = await queryUserTool.invoke(args);

  //         messages.push(
  //           new ToolMessage({
  //             tool_call_id: toolCallId,
  //             name: toolName,
  //             content: result,
  //           }),
  //         );
  //       }
  //     }
  //   }
  // }

  async *runChainStream(query: string): AsyncGenerator<string> {
    // return this.chain.invoke({ query }) as Promise<string>;

    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具(如query_user)来查询用户信息，再用结果回答用户的问题',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const stream = await this.modeWithTools.stream(messages);

      let fullAIMessage: AIMessageChunk | null = null;

      for await (const chunk of stream as AsyncGenerator<AIMessageChunk>) {
        fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

        const hasToolCallChunk =
          !!fullAIMessage.tool_call_chunks &&
          fullAIMessage.tool_call_chunks.length > 0;

        // $ 只有当前轮次还没出现 tool 调用的chunk，就可以把文本内容往外推
        if (!hasToolCallChunk && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullAIMessage) {
        return;
      }

      messages.push(fullAIMessage);

      const toolCalls = fullAIMessage.tool_calls ?? [];

      // 没有工具调用: 说明这一轮就是最终回答，已经在上面的for await中流完了，可以结束了
      if (!toolCalls.length) {
        return;
      }

      // 依次执行本轮需要调用的所有工具
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;

        // if (toolName === 'query_user') {
        //   const result = await this.queryUserTool.invoke(toolCall.args);

        //   messages.push(
        //     new ToolMessage({
        //       tool_call_id: toolCallId,
        //       name: toolName,
        //       content: result,
        //     }),
        //   );
        // } else
        if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'db_users_curd') {
          const result = await this.dbUsersCrudTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    }
  }

  // async *streamChain(query: string): AsyncGenerator<string> {
  //   const stream = await this.chain.stream({ query });
  //   for await (const chunk of stream) {
  //     yield chunk;
  //   }
  // }
}
