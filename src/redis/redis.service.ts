import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class RedisService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}
  async set(key: string, value: unknown): Promise<void> {
    try {
      if (!key || !value) return;
      await this.cacheManager.set(key, value, 9000000000000);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  async get<T>(key: string): Promise<T> {
    try {
      if (!key) return null;
      return await this.cacheManager.get(key);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  async del(key: string): Promise<any> {
    try {
      return await this.cacheManager.del(key);
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }
}
