import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { Staff } from '../database/models/staff.model.js';
import { RbacService } from './rbac.service.js';
import { workingProfileStorage } from './profile-context.js';

@Injectable()
export class WorkingProfileMiddleware implements NestMiddleware {
  constructor(private readonly rbac:RbacService){}
  async use(request:any,_response:any,next:(error?:any)=>void){
    if(!(request.user instanceof Staff))return next();
    try{
      const profiles=await this.rbac.profiles(request.user);
      const selected=request.session?.activeProfileId;
      const active=profiles.find(profile=>profile.id===selected)||(!selected&&profiles.length===1?profiles[0]:null);
      if(active&&request.session)request.session.activeProfileId=active.id;
      request.workingProfiles=profiles;
      request.activeProfile=active;
      request.profileSelectionRequired=!active;
      workingProfileStorage.run({staffId:request.user.id,roleId:active?.id||null,selectionRequired:!active,requestPath:request.originalUrl||request.url},()=>next());
    }catch(error){next(error);}
  }
}

@Injectable()
export class WorkingProfileGuard implements CanActivate {
  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    if(!(request.user instanceof Staff))return true;
    const path=(request.originalUrl||request.url||'').split('?')[0];
    if(/^\/auth\/(session|profiles(?:\/select)?|capabilities|loginSuccess|login\/success)$/.test(path)
      ||path==='/user/logout'||path==='/accounts/me/password')return true;
    const profile=workingProfileStorage.getStore();
    if(!profile||profile.staffId!==request.user.id||profile.selectionRequired||!profile.roleId){
      throw new ForbiddenException({code:'PROFILE_SELECTION_REQUIRED',message:'Vui lòng chọn hồ sơ làm việc trước khi tiếp tục.'});
    }
    const expected=request.get?.('x-working-profile-id');
    if(expected&&expected!==profile.roleId)throw new ForbiddenException({code:'PROFILE_CONTEXT_CHANGED',message:'Hồ sơ làm việc đã thay đổi. Vui lòng tải lại trước khi thao tác.'});
    return true;
  }
}
