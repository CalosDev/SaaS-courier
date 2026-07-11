import { Module } from '@nestjs/common';
import { OutboxProcessorService } from './outbox-processor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OutboxProcessorService],
  exports: [OutboxProcessorService],
})
export class OutboxModule {}
