import { PartialType } from '@nestjs/mapped-types';
import { CreateAiVercelDto } from './create-ai-vercel.dto';

export class UpdateAiVercelDto extends PartialType(CreateAiVercelDto) {}
