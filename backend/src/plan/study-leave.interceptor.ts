import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { StudyLeaveService } from './study-leave.service.js';

@Injectable()
export class StudyLeaveInterceptor implements NestInterceptor {
  constructor(private readonly leaves: StudyLeaveService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() === 'http') {
      const path = context.switchToHttp().getRequest().url || '';
      if (/\/(plan|masters|scheduling|reports)(\/|\?)/.test(path)) await this.leaves.synchronize();
    }
    return next.handle();
  }
}
