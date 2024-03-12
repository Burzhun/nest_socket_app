import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SocketIoAdapter } from './SocketIoAdapter';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './axios.exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const options = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  };
  app.enableCors(options);
  app.useGlobalFilters(new HttpExceptionFilter());
  const configService = app.get(ConfigService);
  app.useWebSocketAdapter(new SocketIoAdapter(app, configService));
  await app.listen(4000);
}
bootstrap();
