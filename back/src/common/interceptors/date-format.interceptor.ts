import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { formatDateEs } from '../date-format';

function transformDates(value: any): any {
  if (value instanceof Date) {
    return formatDateEs(value);
  }

  if (Array.isArray(value)) {
    return value.map(transformDates);
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = transformDates(val);
    }
    return result;
  }

  return value;
}

@Injectable()
export class DateFormatInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transformDates(data)));
  }
}
