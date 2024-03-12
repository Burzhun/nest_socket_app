import { Module } from '@nestjs/common';
import { ConstructorService } from './constructor.service';
import { HttpModule, HttpService } from '@nestjs/axios/dist';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TableModule } from 'src/table/table.module';
import { SchemeModule } from 'src/scheme/scheme.module';

@Module({
  imports: [ConfigModule, HttpModule, TableModule, SchemeModule],
  controllers: [],
  providers: [ConstructorService],
  exports: [ConstructorService],
})
export class ConstructorModule {}
