import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '@anura/shared';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);

  // In development, reflect the request origin so any localhost port works
  // (the web dev server may be assigned a different port). Lock to WEB_ORIGIN in prod.
  const isDev = config.get<string>('env') !== 'production';
  app.enableCors({
    origin: isDev ? true : config.get<string>('webOrigin'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Anura API listening on http://localhost:${port}/${API_PREFIX}`);
}

bootstrap();
