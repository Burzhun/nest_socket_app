import { Global, Module } from '@nestjs/common';
import type { RedisClientOptions } from 'redis';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisService } from './redis.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

const redisModuleFactory = CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    isGlobal: true,
    store: redisStore,
    url: process.env.REDIS_URL,
  }),
  inject: [ConfigService],
});

@Global()
@Module({
  imports: [ConfigModule, redisModuleFactory],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
