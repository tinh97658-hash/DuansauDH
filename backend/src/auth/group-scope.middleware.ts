import { Injectable, NestMiddleware } from '@nestjs/common';
import { groupScopeStorage } from './group-scope-context.js';

@Injectable()
export class GroupScopeMiddleware implements NestMiddleware {
  use(_request: any, _response: any, next: () => void) {
    // Nest binds AsyncResources before interceptors. Initialize one mutable,
    // request-local context here so those resources retain subsequent scope configuration.
    groupScopeStorage.run({ staffId: '', restrictView: false, restrictEdit: false, readOnly: false }, next);
  }
}
