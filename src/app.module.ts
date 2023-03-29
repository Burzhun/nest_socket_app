import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppGateway } from './app/app.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [AppGateway],
})
export class AppModule {}
