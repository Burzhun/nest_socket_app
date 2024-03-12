import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppGateway } from './app/app.gateway';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppService } from './app/app.service';
import { HttpModule } from '@nestjs/axios';
import type { RedisClientOptions } from 'redis';
import { redisStore } from 'cache-manager-redis-yet';
import { ScheduleModule } from '@nestjs/schedule';
import { SchemeService } from './scheme/scheme.sevice';
import { SchemeModule } from './scheme/scheme.module';
import { TableModule } from './table/table.module';
import { RedisModule } from './redis/redis.module';
import { TriggersModule } from './triggers/triggers.module';
import { ConstructorModule } from './constructor/constructor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    HttpModule,
    SchemeModule,
    TableModule,
    RedisModule,
    TriggersModule,
    ConstructorModule,
  ],
  controllers: [AppController],
  providers: [AppGateway, AppService],
})
export class AppModule {}
