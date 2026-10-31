import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  AIMessageChunk,
  createAgent,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from 'langchain';
import { UIMessage } from 'ai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

@Injectable()
export class AiVercelService {
  private readonly agent: ReturnType<typeof createAgent>;

  constructor(
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('CHAT_MODEL') model: ChatOpenAI,
  ) {
    this.agent = createAgent({
      model,
      tools: [this.webSearchTool, this.sendMailTool],
      systemPrompt:
        '你是 AI 助手，需要最新信息、事实核查或联网信息时，请使用 web_search 工具搜索后再作答。发送邮件用 send_mail 工具',
    });
  }

  async stream(messages: UIMessage[]) {
    // 将ai sdk的message转成langchain的BaseMessage传给agent
    const lcMessages = await toBaseMessages(messages);
    console.log('lcMessages: ', lcMessages);
    const lgStream = await this.agent.stream(
      { messages: lcMessages },
      {
        streamMode: ['messages', 'values'],
        recursionLimit: 30,
      },
    );

    // 再把返回的stream转成ai ask的ui message stream进行返回， 这样返回的流式内容就是SSE的Data Stream Protocol的协议数据了
    return toUIMessageStream(lgStream as AsyncIterable<AIMessageChunk>);
  }
}
