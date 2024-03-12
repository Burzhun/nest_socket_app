import { Module } from '@nestjs/common';
import { SchemeService } from './scheme.sevice';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [SchemeService, HttpModule, ConfigService],
  exports: [SchemeService],
})
export class SchemeModule {}
