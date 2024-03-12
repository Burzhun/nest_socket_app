import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter<T> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    console.log(exception);

    // response.status(400).json({
    //   statusCode: 400,
    //   timestamp: new Date().toISOString(),
    //   path: request.url,
    // });
  }
}
