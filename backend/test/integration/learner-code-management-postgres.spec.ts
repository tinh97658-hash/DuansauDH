import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { AppModule } from '../../src/app.module.js';
import { LearnerCodeService } from '../../src/learner-codes/code.service.js';
import { GroupScopeService } from '../../src/auth/group-scope.service.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';
import { AuditService } from '../../src/audit/audit.service.js';
import { DEFAULT_CODE_PARTS } from '../../src/learner-codes/code-format.js';
import { AdmissionEvaluationService } from '../../src/plan/admission-evaluation.service.js';
import { admissionRecordSnapshot, DEFAULT_ADMISSION_RULES } from '../../src/plan/admission-scoring.js';

const describeDb=process.env.RUN_DASHBOARD_DB_TESTS==='true'?describe:describe.skip;
describeDb('Configured learner codes on real PostgreSQL and active-profile RLS',()=>{
  let app:any,db:any,service:LearnerCodeService,actor:any,profile:any,group:any,major:any,regular:any,special:any;
  const read=(sql:string,values:any={})=>db.query(sql,{replacements:values,type:QueryTypes.SELECT});
  const run=async<T>(method:string,path:string,work:()=>Promise<T>,role=profile)=>workingProfileStorage.run(
    {staffId:actor.id,roleId:role.id,selectionRequired:false,requestMethod:method,requestPath:path},async()=>{
      const access=await app.get(RbacService).effectiveAccess(actor);
      return app.get(GroupScopeService).run(actor.id,access,work);
    });
  const config=<T>(work:()=>Promise<T>)=>run('PUT','/learner-codes/types',work);
  const records:string[]=[];
  const add=async(name:string,typeId=regular.id,status='approved')=>{
    const row=await db.models.AdmissionRecord.create({fullName:name,firstName:name,lastName:'Test',academicYear:'2026',majorId:major.id,trainingLevel:'Thạc sĩ',status})
      .catch((error:any)=>{throw new Error(error.original?.message||error.message);});
    await db.models.ClassGroupMember.create({classGroupId:group.id,admissionRecordId:row.id});
    if(typeId!==regular.id)await run('PUT',`/learner-codes/records/${row.id}/type`,()=>service.setType(actor,row.id,{typeId,reason:'Phân loại kiểm thử'}));
    records.push(row.id);return row;
  };
  const preview=(ids:string[])=>run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:group.id,recordIds:ids}));
  const issue=async(ids:string[],p?:any,requestId=randomUUID())=>{
    const before=p||await preview(ids);
    const dto={classGroupId:group.id,recordIds:ids,fingerprint:before.fingerprint,requestId};
    return {dto,result:await run('POST','/learner-codes/issue',()=>service.issue(actor,dto))};
  };
  beforeAll(async()=>{
    if(!/\/pgsms_dashboard_test_\d+$/.test(process.env.DATABASE_URL||''))throw Error('Disposable database required');
    app=await NestFactory.createApplicationContext(AppModule,{logger:false,abortOnError:false});
    db=app.get(getConnectionToken());service=app.get(LearnerCodeService);
    actor=await db.models.Staff.findOne({where:{email:'dashboard-test@example.invalid'}});
    profile=await db.models.Role.findOne({where:{code:'admin'}});
    await db.models.StaffRole.findOrCreate({where:{staffId:actor.id,roleId:profile.id}});
    const discipline=await db.models.Discipline.create({code:'CODETEST',name:'Code test'});
    major=await db.models.Major.create({code:'CODETEST',name:'Code major',disciplineId:discipline.id,program:'masters'});
    group=await db.models.ClassGroup.create({code:'CODE-2026',name:'Code class',majorId:major.id,program:'masters',academicYear:'2026',intakeRound:1,groupNumber:2,responsibleStaffId:actor.id});
    [regular]=await read("SELECT * FROM learner_code_types WHERE key='regular'");
    [special]=await read("SELECT * FROM learner_code_types WHERE key='pre_masters'");
    await config(()=>service.saveType(actor,special.id,{key:special.key,name:special.name,letter:'B',active:true,requiresAdmission:true,version:special.version}));
    await run('PUT',`/learner-codes/abbreviations/${major.id}`,()=>service.abbreviation(actor,major.id,'CN'));
  },30000);
  afterAll(async()=>{await app?.close();});
  it('issues the requested interleaved sequence without consuming the regular counter for special records',async()=>{
    const a=await add('Bình'),b=await add('Chi'),s=await add('An',special.id),c=await add('Dung');
    expect((await issue([a.id,b.id])).result.rows.map(r=>r.code)).toEqual(['CN2612001','CN2612002']);
    expect((await issue([s.id])).result.rows[0].code).toBe('CN261201B');
    expect((await issue([c.id])).result.rows[0].code).toBe('CN2612003');
    expect((await read('SELECT intake_code,learner_code_state FROM admission_records WHERE id=:id',{id:a.id}))[0]).toMatchObject({intake_code:a.code,learner_code_state:'official'});
  });
  it('does not consume numbers on preview and makes retries idempotent',async()=>{
    const a=await add('Giang'),p=await preview([a.id]);
    expect((await preview([a.id])).fingerprint).toBe(p.fingerprint);
    const sent=await issue([a.id],p);
    const retried=await run('POST','/learner-codes/issue',()=>service.issue(actor,sent.dto));
    expect(retried).toEqual(sent.result);
    const reordered=Object.fromEntries(Object.entries(sent.dto).reverse());
    expect(await run('POST','/learner-codes/issue',()=>service.issue(actor,reordered as any))).toEqual(sent.result);
    expect((await read("SELECT COUNT(*)::int AS n FROM learner_code_events WHERE record_id=:id AND action='issue'",{id:a.id}))[0].n).toBe(1);
  });
  it('rejects a stale preview and permits only one of two simultaneous confirmations of the same preview',async()=>{
    const a=await add('Hoa'),p=await preview([a.id]);
    const dto={classGroupId:group.id,recordIds:[a.id],fingerprint:p.fingerprint};
    const results=await Promise.allSettled([1,2].map(()=>run('POST','/learner-codes/issue',()=>service.issue(actor,{...dto,requestId:randomUUID()}))));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  });
  it('rejects pending admissions and mixed valid/invalid batches without changing counters or codes',async()=>{
    const a=await add('Khánh'),b=await add('Linh',regular.id,'pending');
    const before=await read('SELECT * FROM learner_code_counters ORDER BY key');
    await expect(preview([a.id,b.id])).rejects.toThrow('trúng tuyển');
    expect(await read('SELECT * FROM learner_code_counters ORDER BY key')).toEqual(before);
    expect((await read('SELECT learner_code_state FROM admission_records WHERE id=:id',{id:a.id}))[0].learner_code_state).toBe('provisional');
  });
  it('blocks changing an official code through ordinary profile SQL and preserves permanent reservations on reissue',async()=>{
    const a=await add('Minh');await issue([a.id]);
    await expect(db.models.AdmissionRecord.update({code:'BYPASS'},{where:{id:a.id}})).rejects.toThrow();
    const row=await run('GET',`/learner-codes/records/${a.id}`,()=>service.record(actor,a.id));
    await run('POST',`/learner-codes/records/${a.id}/reissue`,()=>service.reissue(actor,a.id,{code:'CN-REPLACEMENT',reason:'Điều chỉnh kiểm thử',fingerprint:row.fingerprint,requestId:randomUUID()}));
    expect((await read('SELECT 1 FROM learner_code_reservations WHERE code_key=lower(:code)',{code:row.code}))).toHaveLength(1);
    const history=await run('GET',`/learner-codes/records/${a.id}/history`,()=>service.history(actor,a.id));
    expect(history.map(h=>h.action)).toEqual(['reissue','issue']);
  });
  it('does not treat admission management as code issuance and prevents cross-profile privilege union',async()=>{
    const role=await db.models.Role.create({code:'code_reader',name:'Reader',active:true,restrictGroupView:true,restrictGroupEdit:true});
    await db.models.StaffRole.create({staffId:actor.id,roleId:role.id});
    await db.query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT :role,id,now(),now() FROM permissions WHERE code IN ('module.admission','admission.view','admission.manage','route.plan.learner-codes.view')`,{replacements:{role:role.id}});
    const a=await add('Nga');
    await expect(run('POST','/learner-codes/issue',()=>service.issue(actor,{classGroupId:group.id,recordIds:[a.id],fingerprint:'0'.repeat(64),requestId:randomUUID()}),role)).rejects.toThrow();
  });
  const cloneRole=async(flags:any={})=>{
    const role=await db.models.Role.create({code:`code_${randomUUID().slice(0,8)}`,name:'Scoped test',active:true,restrictGroupView:true,restrictGroupEdit:true,...flags});
    await db.models.StaffRole.create({staffId:actor.id,roleId:role.id});
    await db.query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT :role,permission_id,now(),now() FROM role_permissions WHERE role_id=:admin ON CONFLICT DO NOTHING`,{replacements:{role:role.id,admin:profile.id}});
    return role;
  };
  it('allows a delegated issuer inside the assigned class but rejects configuration and foreign-class access',async()=>{
    const role=await cloneRole(),a=await add('Oanh');
    const p=await run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:group.id,recordIds:[a.id]}),role);
    await run('POST','/learner-codes/issue',()=>service.issue(actor,{classGroupId:group.id,recordIds:[a.id],fingerprint:p.fingerprint,requestId:randomUUID()}),role);
    await expect(run('PUT',`/learner-codes/abbreviations/${major.id}`,()=>service.abbreviation(actor,major.id,'XX'),role)).rejects.toThrow();
    const foreign=await db.models.ClassGroup.create({code:'OTHER-CODE',name:'Outside',majorId:major.id,program:'masters',academicYear:'2026',groupNumber:3});
    await expect(run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:foreign.id,recordIds:[a.id]}),role)).rejects.toThrow();
  });
  it('permits preview for a read-only profile but forbids issuance',async()=>{
    const role=await cloneRole({groupReadOnly:true}),a=await add('Phương');
    const p=await run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:group.id,recordIds:[a.id]}),role);
    await expect(run('POST','/learner-codes/issue',()=>service.issue(actor,{classGroupId:group.id,recordIds:[a.id],fingerprint:p.fingerprint,requestId:randomUUID()}),role)).rejects.toThrow();
  });
  it('rechecks current grants after preview and before replay',async()=>{
    const role=await cloneRole(),a=await add('Quân');
    const p=await run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:group.id,recordIds:[a.id]}),role);
    const dto={classGroupId:group.id,recordIds:[a.id],fingerprint:p.fingerprint,requestId:randomUUID()};
    await run('POST','/learner-codes/issue',()=>service.issue(actor,dto),role);
    await db.query(`DELETE FROM role_permissions WHERE role_id=:role AND permission_id=(SELECT id FROM permissions WHERE code='learnercode.issue')`,{replacements:{role:role.id}});
    await expect(run('POST','/learner-codes/issue',()=>service.issue(actor,dto),role)).rejects.toThrow();
  });
  it('rolls back issued codes, reservations, counters and history when audit writing fails mid-batch',async()=>{
    const a=await add('Sơn'),b=await add('Thanh'),p=await preview([a.id,b.id]);
    const before=await read('SELECT * FROM learner_code_counters ORDER BY key');
    const audit=jest.spyOn(app.get(AuditService),'record').mockRejectedValueOnce(new Error('audit unavailable'));
    try{await expect(issue([a.id,b.id],p)).rejects.toThrow('audit unavailable');}finally{audit.mockRestore();}
    expect(await read('SELECT * FROM learner_code_counters ORDER BY key')).toEqual(before);
    expect(await read("SELECT id FROM admission_records WHERE id IN (:ids) AND learner_code_state='official'",{ids:[a.id,b.id]})).toHaveLength(0);
    expect(await read('SELECT id FROM learner_code_events WHERE record_id IN (:ids)',{ids:[a.id,b.id]})).toHaveLength(0);
    expect(await read('SELECT code_key FROM learner_code_reservations WHERE code_key IN (:codes)',{codes:p.rows.map(r=>r.code.toLowerCase())})).toHaveLength(0);
  });
  it('supports type-specific rules and changing a letter without resetting the existing counter or old codes',async()=>{
    await run('POST','/learner-codes/rules',()=>service.saveRule(actor,null,{name:'Tiền thạc sĩ riêng',active:true,typeId:special.id,
      counterScope:'class',startNumber:37,parts:DEFAULT_CODE_PARTS}));
    const a=await add('Uyên',special.id),p=await preview([a.id]);
    expect(p.rows[0].code).toBe('CN261202B');
    const [type]=await read('SELECT * FROM learner_code_types WHERE id=:id',{id:special.id});
    await config(()=>service.saveType(actor,type.id,{key:type.key,name:type.name,letter:'H',active:true,requiresAdmission:true,version:type.version}));
    await expect(issue([a.id],p)).rejects.toThrow('xem trước');
    expect((await issue([a.id])).result.rows[0].code).toBe('CN261202H');
    expect(await read("SELECT code FROM admission_records WHERE code='CN261201B'")).toHaveLength(1);
    const counters=await run('GET','/learner-codes/counters',()=>service.counters(actor));
    expect(counters.some(row=>row.type_name===type.name&&row.group_code===group.code&&Number(row.next_number)===3)).toBe(true);
  },30000);
  it('classifies an unassigned special application automatically from its profile category without treating it as an official learner',async()=>{
    const row=await db.models.AdmissionRecord.create({fullName:'Vân',academicYear:'2026',majorId:major.id,
      trainingLevel:'Thạc sĩ',status:'pending',profileCategory:'Cựu SV Tiền thạc sỹ'});
    expect(row.learnerCodeTypeId).toBe(special.id);
    const options=await run('GET','/learner-codes/options',()=>service.options(actor,row.id));
    expect(options.defaultGroupId).toBeUndefined();expect(options.requestedRecord.id).toBe(row.id);
    expect(options.requestedRecord.learner_code_type_id).toBe(special.id);
    expect(options.requestedRecord.type_name).toBe(special.name);
    const [updated]=await read('SELECT code,learner_code_state,learner_code_type_id FROM admission_records WHERE id=:id',{id:row.id});
    expect(updated).toMatchObject({code:row.code,learner_code_state:'provisional',learner_code_type_id:special.id});
  });
  it('rejects out-of-range counter advances without modifying either regular or special counters',async()=>{
    const before=await read('SELECT * FROM learner_code_counters ORDER BY key');
    for(const typeId of [regular.id,special.id]){
      const counter=before.find(row=>JSON.parse(row.key)[2]===typeId);
      const nextNumber=typeId===regular.id?1000:100;
      await expect(run('POST','/learner-codes/counters/advance',()=>service.advance(actor,{key:counter.key,nextNumber,reason:'Kiểm tra giới hạn'}))).rejects.toThrow('vượt dải');
    }
    expect(await read('SELECT * FROM learner_code_counters ORDER BY key')).toEqual(before);
  });
  it('accepts a valid advance and can still issue the final code in that range',async()=>{
    const other=await db.models.ClassGroup.create({code:'CODE-BOUNDARY',name:'Boundary',majorId:major.id,program:'masters',academicYear:'2026',intakeRound:1,groupNumber:9});
    const make=async(name:string)=>{
      const row=await db.models.AdmissionRecord.create({fullName:name,academicYear:'2026',majorId:major.id,trainingLevel:'Thạc sĩ',status:'approved'});
      await db.models.ClassGroupMember.create({classGroupId:other.id,admissionRecordId:row.id});return row;
    };
    const first=await make('Boundary first');
    const p=await run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:other.id,recordIds:[first.id]}));
    await run('POST','/learner-codes/issue',()=>service.issue(actor,{classGroupId:other.id,recordIds:[first.id],fingerprint:p.fingerprint,requestId:randomUUID()}));
    const [counter]=await read('SELECT * FROM learner_code_counters WHERE key::jsonb->>6=:id',{id:other.id});
    await run('POST','/learner-codes/counters/advance',()=>service.advance(actor,{key:counter.key,nextNumber:999,reason:'Nhảy tới cuối dải'}));
    const last=await make('Boundary last');
    const final=await run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:other.id,recordIds:[last.id]}));
    expect(final.rows[0].code).toBe('CN2619999');
    await run('POST','/learner-codes/issue',()=>service.issue(actor,{classGroupId:other.id,recordIds:[last.id],fingerprint:final.fingerprint,requestId:randomUUID()}));
  },30000);
  it('blocks effective leave in preview and confirmation even before the cached study status is synchronized',async()=>{
    const row=await add('Bảo lưu đến hạn');
    await db.models.AdmissionRecord.update({studyStatus:'Đang học',extraData:{tuitionPayment:{paid:true}}},{where:{id:row.id}});
    const p=await preview([row.id]);
    await db.query(`INSERT INTO study_leaves(id,admission_record_id,reason,start_date,end_date,status)
      VALUES(:id,:record,'Bảo lưu đến hạn',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
        (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+30,'approved')`,{replacements:{id:randomUUID(),record:row.id}});
    const before=await read('SELECT * FROM learner_code_counters ORDER BY key');
    await expect(preview([row.id])).rejects.toThrow('bảo lưu');
    await expect(issue([row.id],p)).rejects.toThrow('bảo lưu');
    const reader=await cloneRole({groupReadOnly:true});
    await expect(run('GET','/learner-codes/preview',()=>service.preview(actor,{classGroupId:group.id,recordIds:[row.id]}),reader)).rejects.toThrow('bảo lưu');
    expect(await read('SELECT * FROM learner_code_counters ORDER BY key')).toEqual(before);
    expect((await read('SELECT study_status FROM admission_records WHERE id=:id',{id:row.id}))[0].study_status).toBe('Đang học');
  },30000);
  it('does not activate a leave before its future start date when checking codes',async()=>{
    const row=await add('Bảo lưu tương lai');
    await db.query(`INSERT INTO study_leaves(id,admission_record_id,reason,start_date,end_date,status)
      VALUES(:id,:record,'Bảo lưu tương lai',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+1,
        (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+30,'approved')`,{replacements:{id:randomUUID(),record:row.id}});
    expect((await preview([row.id])).rows).toHaveLength(1);
  });
  it('keeps the decision, class membership and official code intact when ordinary reopening is rejected',async()=>{
    const row=await add('Đã phân lớp cấp mã');await issue([row.id]);
    const round=await db.models.AdmissionRound.create({name:'Reopen guard',academicYear:'2026',regulationNo:'TEST',rules:DEFAULT_ADMISSION_RULES});
    const evaluation=await db.models.AdmissionEvaluation.create({admissionRecordId:row.id,roundId:round.id,inputs:{},recordSnapshot:admissionRecordSnapshot(row),decision:'admitted'});
    const [before]=await read('SELECT code,status FROM admission_records WHERE id=:id',{id:row.id});
    await expect(run('POST',`/plan/admission-records/${row.id}/evaluation/decision`,()=>app.get(AdmissionEvaluationService).decide(row.id,{decision:'reopen',note:'Thử mở lại',version:evaluation.version},actor))).rejects.toThrow('đã phân lớp hoặc cấp mã');
    expect((await read('SELECT code,status FROM admission_records WHERE id=:id',{id:row.id}))[0]).toEqual(before);
    expect(await read('SELECT id FROM class_group_members WHERE admission_record_id=:id',{id:row.id})).toHaveLength(1);
    expect((await read('SELECT decision,version FROM admission_evaluations WHERE id=:id',{id:evaluation.id}))[0]).toEqual({decision:'admitted',version:evaluation.version});
  },30000);
  const legacyRecord=async(category:string|null)=>{
    const row=await add(`Hồ sơ cũ ${category||'trống'}`);
    // Reproduce a row predating migration 102, in the disposable database only.
    await db.transaction(async(transaction:any)=>{
      await db.query('ALTER TABLE admission_records DISABLE TRIGGER z_learner_code_guard',{transaction});
      await db.query(`UPDATE admission_records SET learner_code_type_id=NULL,learner_code_state='legacy',profile_category=:category WHERE id=:id`,
        {replacements:{id:row.id,category},transaction});
      await db.query('ALTER TABLE admission_records ENABLE TRIGGER z_learner_code_guard',{transaction});
    });
    return row;
  };
  it.each(['Bình thường',null,'','   '])('recognizes ordinary legacy profiles consistently in list, details and issuance: %p',async(category)=>{
    const row=await legacyRecord(category);
    const listed=await run('GET',`/learner-codes/class/${group.id}/records`,()=>service.classRecords(actor,group.id));
    expect(listed.find(r=>r.id===row.id)).toMatchObject({learner_code_type_id:regular.id,type_name:regular.name});
    expect(await run('GET',`/learner-codes/records/${row.id}`,()=>service.record(actor,row.id))).toMatchObject({learner_code_type_id:regular.id,type_name:regular.name});
    const p=await preview([row.id]);
    expect(p.rows[0].typeName).toBe(regular.name);
    expect((await read('SELECT learner_code_type_id,learner_code_state FROM admission_records WHERE id=:id',{id:row.id}))[0]).toEqual({learner_code_type_id:null,learner_code_state:'legacy'});
    await issue([row.id],p);
    expect((await read('SELECT learner_code_type_id,learner_code_state FROM admission_records WHERE id=:id',{id:row.id}))[0]).toEqual({learner_code_type_id:regular.id,learner_code_state:'official'});
  });
  it.each(['Sinh viên','Dự thính','Không rõ'])('blocks preview for inactive or unknown legacy categories: %s',async(category)=>{
    const row=await legacyRecord(category);
    const loaded=await run('GET',`/learner-codes/records/${row.id}`,()=>service.record(actor,row.id));
    if(category==='Không rõ'){
      expect(loaded).toMatchObject({learner_code_type_id:null,type_name:null});
    }else{
      expect(loaded.type_name).toBe(category);
    }
    await expect(preview([row.id])).rejects.toThrow('chưa có loại hợp lệ');
  });
  it('supports adding custom non-special and special profile categories synced dynamically to intake records',async()=>{
    const typesBefore=await run('GET','/learner-codes/options',()=>service.options(actor));
    expect(typesBefore.types.map((t:any)=>t.name).slice(0,5)).toEqual([
      'Bình thường','Dự thính','Sinh viên','Cựu SV học trước','Cựu SV Tiền thạc sỹ',
    ]);
    const standardCustom=await config(()=>service.saveType(actor,null,{
      name:'Chuyển tiếp',usesSpecialCode:false,active:true,requiresAdmission:true,
    }));
    expect(standardCustom).toMatchObject({name:'Chuyển tiếp',uses_special_code:false,letter:null,active:true});
    const rowA=await add('Xuân');
    const rowB=await db.models.AdmissionRecord.create({
      fullName:'Yến',academicYear:'2026',majorId:major.id,trainingLevel:'Thạc sĩ',status:'approved',profileCategory:'Chuyển tiếp',
    });
    expect(rowB.learnerCodeTypeId).toBe(standardCustom.id);
    await db.models.ClassGroupMember.create({classGroupId:group.id,admissionRecordId:rowB.id});
    const issued=await issue([rowA.id,rowB.id]);
    const codes=issued.result.rows.map((r:any)=>({fullName:r.fullName,typeName:r.typeName,code:r.code}));
    expect(codes).toEqual([
      {fullName:'Xuân',typeName:'Bình thường',code:expect.stringMatching(/^CN2612\d{3}$/)},
      {fullName:'Yến',typeName:'Chuyển tiếp',code:expect.stringMatching(/^CN2612\d{3}$/)},
    ]);
    expect(Number(codes[1].code.slice(-3))).toBe(Number(codes[0].code.slice(-3))+1);
    await expect(db.models.AdmissionRecord.update({profileCategory:'Bình thường'},{where:{id:rowB.id}})).rejects.toThrow();
  },30000);
  it('keeps an explicitly assigned special type even if the historical category says ordinary',async()=>{
    const row=await legacyRecord('Bình thường');
    await run('PUT',`/learner-codes/records/${row.id}/type`,()=>service.setType(actor,row.id,{typeId:special.id,reason:'Xác minh loại riêng'}));
    expect(await run('GET',`/learner-codes/records/${row.id}`,()=>service.record(actor,row.id))).toMatchObject({learner_code_type_id:special.id,type_name:special.name});
  });
});
