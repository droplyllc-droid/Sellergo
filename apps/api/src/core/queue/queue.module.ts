import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: QueueService,
      useFactory: (configService: ConfigService) => {
        return new QueueService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [QueueService],
})
export class QueueModule {}
