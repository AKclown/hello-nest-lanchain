import { Module } from '@nestjs/common';
import { AiVercelService } from './ai-vercel.service';
import { AiVercelController } from './ai-vercel.controller';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [ToolModule],
  controllers: [AiVercelController],
  providers: [AiVercelService],
})
export class AiVercelModule {}
