import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiVercelService } from './ai-vercel.service';
import { pipeUIMessageStreamToResponse, UIMessage } from 'ai';

@Controller('ai-vercel')
export class AiVercelController {
  constructor(private readonly aiVercelService: AiVercelService) {}

  /**
    本地测试：
    curl -N -sS -X POST 'http://localhost:3000/ai-vercel/chat' \
      -H 'Content-Type: application/json' \
      -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"北京今天的天气"}]}]}'
   */
  @Post('chat')
  async postChat(
    @Body() body: { messages?: UIMessage[] },
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    console.log('原始 messages:', JSON.stringify(body.messages));

    if (!body?.messages || !Array.isArray(body.messages)) {
      throw new BadRequestException('Invalid JSON');
    }

    const stream = await this.aiVercelService.stream(body.messages);
    // 因为ai sdk转换好的是SSE的流，我们不需要自己再做处理，直接将它传给response就可以了
    pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
