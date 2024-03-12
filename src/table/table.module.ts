import { Module } from '@nestjs/common';
import { TableService } from './table.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { SchemeService } from 'src/scheme/scheme.sevice';

@Module({
  imports: [ConfigModule, ScheduleModule, HttpModule],
  controllers: [],
  providers: [TableService, SchemeService],
  exports: [TableService],
})
export class TableModule {}
