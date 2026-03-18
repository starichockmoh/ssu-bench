import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { appConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableShutdownHooks();
  app.setGlobalPrefix('');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const server = app.getHttpServer() as {
    keepAliveTimeout?: number;
    headersTimeout?: number;
    requestTimeout?: number;
  };
  server.keepAliveTimeout = appConfig.timeouts.keepAlive;
  server.headersTimeout = appConfig.timeouts.headers;
  server.requestTimeout = appConfig.timeouts.request;

  await app.listen(appConfig.port);
}

bootstrap();
