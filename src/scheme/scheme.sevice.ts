import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios/dist';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

import { SchemeData, SchemeRequestResponse, SchemeStore } from '../types';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class SchemeService {
  private host: string;
  private token: string;

  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.host = configService.get('SERVER_HOST');
    this.token = configService.get('TOKEN');
  }

  async getScheme(schemeId: number): Promise<SchemeData> {
    try {
      const host = this.host;
      const token = 'Bearer ' + this.token;
      const data = await firstValueFrom(
        this.httpService
          .get<SchemeRequestResponse>(
            `${host}/api/table-engine/scheme/${schemeId}`,
            {
              headers: {
                Authorization: token,
              },
            },
          )
          .pipe(
            catchError((e) => {
              throw new HttpException(e.response?.data, e.response?.status);
            }),
          ),
      );
      // this.storeSchemeTable(schemeId, tableId);
      return data.data.payload; 
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  async saveScheme(schemeId: number, data: SchemeData): Promise<boolean> {
    try {
      const host = this.host;
      const token = 'Bearer ' + this.token;
      const response = await firstValueFrom(
        this.httpService
          .put(`${host}/api/table-engine/scheme/${schemeId}`, data, {
            headers: {
              Authorization: token,
            },
          })
          .pipe(
            catchError((e) => {
              console.log(e);
              throw new HttpException(e.response?.data, e.response?.status);
            }),
          ),
      );

      // this.storeSchemeTable(schemeId, tableId);
      return response.data.status;
    } catch {
      return false;
    }
  }

  async storeSchemeTable(schemeId: number, tableId: number) {
    const schemeStore: SchemeStore = await this.redisService.get('schemeStore');
    if (!schemeStore) {
      const data = { [schemeId]: [tableId] };
      await this.redisService.set('schemeStore', data);
    } else {
      if (!schemeStore[schemeId]) schemeStore[schemeId] = [];
      if (schemeStore[schemeId].includes(tableId)) return;
      schemeStore[schemeId].push(tableId);
      await this.redisService.set('schemeStore', schemeStore);
    }
  }

  async getSchemeTables(schemeId: number): Promise<number[]> {
    const schemeStore: SchemeStore = await this.redisService.get('schemeStore');
    if (!schemeStore || !schemeStore[schemeId]) return [];
    else return schemeStore[schemeId];
  }

  async getAdminScheme(schemeId: number): Promise<SchemeData> {
    let scheme = await this.redisService.get<SchemeData>(
      'schemeOptionConstructor' + schemeId,
    );
    if (!scheme) {
      scheme = await this.getScheme(schemeId);
      if (!scheme) {
        return undefined;
      }
      this.redisService.set('schemeOptionConstructor' + schemeId, scheme);
    }
    return scheme;
  }
}
