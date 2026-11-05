import { isIsolatedScopeDatabase } from '../helpers/isolated-database.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/sequelize';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { ROUTE_PERMISSION_ENTRIES } from '../../src/auth/route-permissions.js';

const describeDb=process.env.RUN_GROUP_SCOPE_POSTGRES_TESTS==='true'?describe:describe.skip;
describeDb('Working profiles through sessions, HTTP guards and PostgreSQL',()=>{
  let app:any,db:any,agent:any,origin:string,permissionIds:string[];
  const staffId=randomUUID(),viewer=randomUUID(),manager=randomUUID();
  beforeAll(async()=>{
    if(!isIsolatedScopeDatabase(process.env.DATABASE_URL))throw new Error('Use the isolated test database.');
    app=await NestFactory.create(AppModule,{logger:false});db=app.get(getConnectionToken());
    origin=String(app.get(ConfigService).get('FRONTEND_URL')).replace(/\/$/,'');
    app.use((req:any,_res:any,next:any)=>{req.user=Staff.build({id:staffId,name:'Profile test',email:staffId+'@example.invalid',role:'profile-test',status:'active',mustChangePassword:false});req.isAuthenticated=()=>true;next();});
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
    await app.init();
    const m=db.models;
    await m.Staff.create({id:staffId,name:'Profile test',email:staffId+'@example.invalid',role:'profile-test'});
    for(const [id,name,readonly] of [[viewer,'Viewer',true],[manager,'Manager',false]])await m.Role.create({id,code:'p_'+id,name,active:true,groupReadOnly:readonly});
    const permissions=await m.Permission.findAll();const byCode=new Map(permissions.map((permission:any)=>[permission.code,permission.id]));
    for(const [role,codes] of [[viewer,['module.administration','role.view']],[manager,['module.administration','role.view','role.manage','account.view','account.manage']]] as const){
      await m.StaffRole.create({staffId,roleId:role});
      const routeCodes=ROUTE_PERMISSION_ENTRIES.filter(entry=>entry.route.read.every(code=>(codes as readonly string[]).includes(code))&&(!entry.capability||(codes as readonly string[]).includes(entry.capability))).map(entry=>entry.code);
      await m.RolePermission.bulkCreate([...codes,...routeCodes].map(code=>({roleId:role,permissionId:byCode.get(code)})));
    }
    permissionIds=['module.administration','role.view'].map(code=>byCode.get(code) as string);
    agent=request.agent(app.getHttpServer());
  },30000);
  afterAll(async()=>{
    if(db){
      await db.models.AuthAuditLog.destroy({where:{actorStaffId:staffId}});
      await db.models.StaffRole.destroy({where:{staffId}});
      for(const role of [viewer,manager])await db.models.RolePermission.destroy({where:{roleId:role}});
      for(const id of [viewer,manager])await db.models.Role.destroy({where:{id}});
      await db.models.Staff.destroy({where:{id:staffId}});
    }
    await app?.close();
  },30000);
  it('requires a profile and validates immutable assigned role IDs before changing the session',async()=>{
    const session=await agent.get('/auth/session').expect(200);
    expect(session.body.profileSelectionRequired).toBe(true);expect(session.body.profiles).toHaveLength(2);
    const denied=await agent.get('/roles').expect(403);expect(denied.body.code||denied.body.message?.code).toBe('PROFILE_SELECTION_REQUIRED');
    await agent.post('/auth/profiles/select').set('Origin',origin).send({profileId:randomUUID()}).expect(403);
    await agent.post('/auth/profiles/select').set('Origin',origin).send({profileId:viewer}).expect(200);
    const access=await agent.get('/accounts/me/permissions').expect(200);
    expect(access.body.permissions).toContain('role.view');expect(access.body.permissions).not.toContain('role.manage');
    await agent.post('/roles').send({code:'forged',name:'Forbidden'}).expect(403);
  });
  it('switches profiles, rejects stale-tab requests and prevents self lockout',async()=>{
    await agent.post('/auth/profiles/select').set('Origin',origin).send({profileId:manager}).expect(200);
    const access=await agent.get('/accounts/me/permissions').expect(200);
    expect(access.body.permissions).toContain('role.manage');expect(access.body.groupScope.readOnly).toBe(false);
    const stale=await agent.get('/roles').set('X-Working-Profile-Id',viewer).expect(403);
    expect(stale.body.code||stale.body.message?.code).toBe('PROFILE_CONTEXT_CHANGED');
    await agent.put(`/roles/${manager}/permissions`).send({permissionIds}).expect(409);
    expect((await agent.get('/accounts/me/permissions').expect(200)).body.permissions).toContain('role.manage');
  });
  it('enforces route actions through HTTP even when a broad scheduling write capability exists',async()=>{
    const codes=['module.scheduling','scheduling.view','scheduling.write','route.masters.schedule.view'];
    const permissions=await db.models.Permission.findAll();
    const byCode=new Map(permissions.map((permission:any)=>[permission.code,permission.id]));
    await db.models.RolePermission.bulkCreate(codes.map(code=>({roleId:manager,permissionId:byCode.get(code)})));
    await agent.get('/scheduling/teaching-sessions').query({from:'2026-01-01',to:'2026-01-02'}).expect(200);
    await agent.get('/scheduling/pending-teaching-sessions').expect(403);
    await agent.post('/scheduling/course-offerings').send({}).expect(403);
    await db.models.RolePermission.create({roleId:manager,permissionId:byCode.get('route.masters.schedule.scheduling-write')});
    await agent.get('/scheduling/pending-teaching-sessions').expect(200);
    await agent.post('/scheduling/course-offerings').send({}).expect(403);
  });
  it('fails closed after profile revocation without silently activating another assigned role',async()=>{
    await agent.post('/auth/profiles/select').set('Origin',origin).send({profileId:viewer}).expect(200);
    await db.models.StaffRole.destroy({where:{staffId,roleId:viewer}});
    await agent.get('/roles').expect(403);
    expect((await agent.get('/auth/session').expect(200)).body.profileSelectionRequired).toBe(true);
  });
});
