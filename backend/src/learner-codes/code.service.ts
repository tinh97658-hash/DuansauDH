import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { createHash } from 'node:crypto';
import { RbacService } from '../auth/rbac.service.js';
import { workingProfileStorage } from '../auth/profile-context.js';
import { AuditService } from '../audit/audit.service.js';
import { routePermissionAllowed } from '../auth/route-authorization.js';
import { codeCounterKey, codeCounterMaximum, codeRulePriority, formatLearnerCode, validateParts } from './code-format.js';
import { CodeIssueDto, CodePreviewDto, CodeRuleDto, CodeTypeDto } from './code.dto.js';
import { isUUID } from 'class-validator';

const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value,(_key,item)=>
  item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)).digest('hex');
// Match the ordinary-profile default used when accepting applications. Preserve
// explicit code types and never infer a special type from a historical label.
const recordTypeJoin = `LEFT JOIN learner_code_types t ON t.id=r.learner_code_type_id OR (
  r.learner_code_type_id IS NULL AND r.learner_code_state<>'official'
  AND COALESCE(NULLIF(btrim(r.profile_category),''),'Bình thường')='Bình thường' AND t.key='regular')`;
@Injectable()
export class LearnerCodeService {
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly rbac: RbacService, private readonly audit: AuditService) {}
  private q(sql: string, values: any = {}, tx?: Transaction): Promise<any[]> {
    return this.db.query(sql, { replacements: values, transaction: tx, type: QueryTypes.SELECT });
  }
  private async access(actor: any, permission: string, tx?: Transaction, global = false) {
    const profile = workingProfileStorage.getStore();
    if (!profile?.roleId || profile.staffId!==actor.id || profile.selectionRequired) throw new ForbiddenException('Chọn hồ sơ làm việc trước khi thao tác.');
    const [staff]=await this.q("SELECT id FROM staff WHERE id=:id AND status='active' AND session_version=:version",
      {id:actor.id,version:actor.sessionVersion},tx);
    if(!staff)throw new ForbiddenException('Tài khoản hoặc phiên làm việc đã thay đổi. Vui lòng đăng nhập lại.');
    const access = await this.rbac.effectiveAccess(actor, true, tx);
    const read = permission.endsWith('.view') || permission==='learnercode.preview';
    if (!access.permissions.has(permission) || (!read && access.groupScope?.readOnly)
      || (global && access.groupScope?.restrictEdit)
      || !routePermissionAllowed(access.permissions, profile.requestPath||'', profile.requestMethod||'GET', [permission])) {
      throw new ForbiddenException('Hồ sơ làm việc không có quyền hoặc phạm vi phù hợp.');
    }
    return profile;
  }
  private async write<T>(actor: any, permission: string, work: (tx: Transaction) => Promise<T>, global = false) {
    return this.db.transaction(async tx => {
      // Serialize grants/configuration against administrative changes, then use
      // the existing roster mutex to keep membership and eligibility stable.
      await this.q(`SELECT pg_advisory_xact_lock${global?'':'_shared'}(74621901)`,{},tx);
      await this.q('SELECT pg_advisory_xact_lock(21026)',{},tx);
      await this.access(actor,permission,tx,global);
      return work(tx);
    });
  }
  private async log(actor: any, action: string, before: any, after: any, tx: Transaction, recordId: string|null=null, reason: string|null=null) {
    const profile=workingProfileStorage.getStore()!;
    if (recordId) await this.q(`INSERT INTO learner_code_events(record_id,actor_id,profile_id,action,before_data,after_data,reason)
      VALUES(:record,:actor,:profile,:action,CAST(:before AS jsonb),CAST(:after AS jsonb),:reason)`,
    {record:recordId,actor:actor.id,profile:profile.roleId,action,before:JSON.stringify(before),after:JSON.stringify(after),reason},tx);
    await this.audit.record({actorStaffId:actor.id,action:`learnercode.${action}`,metadata:{recordId,before,after,reason}},tx);
  }
  async config(actor: any) {
    await this.access(actor,'learnercode.config.view');
    const [types,rules,abbreviations,majors,groups] = await Promise.all([
      this.q('SELECT * FROM learner_code_types ORDER BY key'),this.q('SELECT * FROM learner_code_rules ORDER BY name'),
      this.q('SELECT a.*,m.name FROM learner_code_abbreviations a JOIN majors m ON m.id=a.major_id ORDER BY m.name'),
      this.q('SELECT id,name,program FROM majors ORDER BY name'),
      this.q("SELECT id,code,name FROM class_groups WHERE group_type='ADMINISTRATIVE' ORDER BY code"),
    ]);
    return {types,rules,abbreviations,majors,groups};
  }
  async options(actor: any,recordId?:string) {
    await this.access(actor,'admission.view');
    const [types,groups]=await Promise.all([this.q('SELECT id,key,name,active FROM learner_code_types ORDER BY key'),
      this.q("SELECT id,code,name,academic_year FROM class_groups WHERE group_type='ADMINISTRATIVE' AND app_group_allowed(id,false) ORDER BY academic_year DESC,code")]);
    let defaultGroupId:string|undefined,requestedRecord:any;
    if(recordId){
      if(!isUUID(recordId))throw new BadRequestException('ID hồ sơ không hợp lệ.');
      requestedRecord=await this.record(actor,recordId);
      const [record]=await this.q('SELECT app_learner_code_primary_group(id) AS id FROM admission_records WHERE id=:id',{id:recordId});
      if(record&&groups.some(g=>g.id===record.id))defaultGroupId=record.id;
    }
    return {types,groups,defaultGroupId,requestedRecord};
  }
  async classRecords(actor:any,id:string) {
    await this.access(actor,'admission.view');
    return this.q(`SELECT DISTINCT r.id,r.code,r.full_name,r.status,r.profile_category,r.intake_code,r.learner_code_state,COALESCE(r.learner_code_type_id,t.id) AS learner_code_type_id,t.name AS type_name
      FROM admission_records r JOIN class_group_members m ON m.admission_record_id=r.id OR (r.student_id IS NOT NULL AND m.student_id=r.student_id)
      ${recordTypeJoin} WHERE m.class_group_id=:id AND app_record_allowed(r.id,false)
      ORDER BY r.full_name,r.id`,{id});
  }
  async saveType(actor: any, id: string|null, dto: CodeTypeDto) {
    return this.write(actor,'learnercode.config.manage',async tx=>{
      const old=id?(await this.q('SELECT * FROM learner_code_types WHERE id=:id',{id},tx))[0]:null;
      if(id&&(!old||old.version!==dto.version))throw new ConflictException('Loại hồ sơ đã thay đổi. Tải lại.');
      if(old&&old.key!==dto.key)throw new BadRequestException('Không đổi khóa định danh loại hồ sơ đã tạo.');
      if(dto.key==='regular'&&(dto.letter||!dto.requiresAdmission||!dto.active))throw new BadRequestException('Hồ sơ thường không có chữ cái và phải xét tuyển.');
      if(dto.key!=='regular'&&dto.active&&!dto.letter)throw new BadRequestException('Nhập chữ cái trước khi kích hoạt loại đặc biệt.');
      const values={id,name:dto.name.trim(),key:dto.key,letter:dto.letter||null,active:dto.active,requires:dto.requiresAdmission};
      const [row]=await this.q(id?`UPDATE learner_code_types SET name=:name,letter=:letter,active=:active,requires_admission=:requires,version=version+1 WHERE id=:id RETURNING *`
        :`INSERT INTO learner_code_types(name,key,letter,active,requires_admission) VALUES(:name,:key,:letter,:active,:requires) RETURNING *`,values,tx);
      await this.log(actor,'type.configure',old,row,tx);return row;
    },true);
  }
  async abbreviation(actor:any,majorId:string,abbreviation:string) {
    return this.write(actor,'learnercode.config.manage',async tx=>{
      const old=await this.q('SELECT * FROM learner_code_abbreviations WHERE major_id=:id',{id:majorId},tx);
      const same=await this.q('SELECT major_id FROM learner_code_abbreviations WHERE abbreviation=:abbreviation AND major_id<>:id',{id:majorId,abbreviation},tx);
      if(same.length)throw new ConflictException('Viết tắt đã được chuyên ngành khác dùng. Chọn viết tắt riêng để tránh trùng mã.');
      const [row]=await this.q(`INSERT INTO learner_code_abbreviations(major_id,abbreviation) VALUES(:id,:abbreviation)
        ON CONFLICT(major_id) DO UPDATE SET abbreviation=EXCLUDED.abbreviation RETURNING *`,{id:majorId,abbreviation},tx);
      await this.log(actor,'abbreviation.configure',old,row,tx);return row;
    },true);
  }
  async saveRule(actor:any,id:string|null,dto:CodeRuleDto) {
    validateParts(dto.parts);
    return this.write(actor,'learnercode.config.manage',async tx=>{
      const old=id?(await this.q('SELECT * FROM learner_code_rules WHERE id=:id',{id},tx))[0]:null;
      if(id&&(!old||old.version!==dto.version))throw new ConflictException('Quy tắc đã thay đổi. Tải lại.');
      if(old&&old.counter_scope!==dto.counterScope)throw new BadRequestException('Tạo quy tắc mới khi đổi phạm vi bộ đếm; không đặt lại bộ đếm quy tắc đang dùng.');
      const all=await this.q('SELECT * FROM learner_code_rules WHERE active',{},tx);
      const fields=['program','major_id','academic_year','intake_round','class_group_id','type_id'];
      const values:any={id,name:dto.name.trim(),active:dto.active,program:dto.program||null,major_id:dto.majorId||null,
        academic_year:dto.academicYear||null,intake_round:dto.intakeRound||null,class_group_id:dto.classGroupId||null,type_id:dto.typeId||null,
        scope:dto.counterScope,start:dto.startNumber,parts:JSON.stringify(dto.parts),effective:dto.effectiveFrom||'1970-01-01'};
      // Reject ambiguous overlaps of the same priority, not just identical selectors.
      const rank=codeRulePriority;
      if(dto.active&&all.some(r=>r.id!==id&&rank(r)===rank(values)&&fields.every(f=>r[f]===null||values[f]===null||String(r[f])===String(values[f])))) {
        throw new ConflictException('Có quy tắc cùng mức ưu tiên giao nhau. Ngừng quy tắc cũ hoặc chọn phạm vi khác.');
      }
      const cols='program,major_id,academic_year,intake_round,class_group_id,type_id';
      const [row]=await this.q(id?`UPDATE learner_code_rules SET name=:name,active=:active,${fields.map(f=>`${f}=:${f}`).join(',')},
        start_number=:start,parts=CAST(:parts AS jsonb),effective_from=CAST(:effective AS date),version=version+1,updated_at=now() WHERE id=:id RETURNING *`
        :`INSERT INTO learner_code_rules(name,active,${cols},counter_scope,start_number,parts,effective_from)
        VALUES(:name,:active,:program,:major_id,:academic_year,:intake_round,:class_group_id,:type_id,:scope,:start,CAST(:parts AS jsonb),CAST(:effective AS date)) RETURNING *`,values,tx);
      await this.log(actor,'rule.configure',old,row,tx);return row;
    },true);
  }
  private async build(dto:CodePreviewDto,tx:Transaction,writing=false) {
    const [group]=await this.q(`SELECT g.*,a.abbreviation FROM class_groups g LEFT JOIN learner_code_abbreviations a ON a.major_id=g.major_id
      WHERE g.id=:id AND g.group_type='ADMINISTRATIVE' AND app_group_allowed(g.id,:writing)`,{id:dto.classGroupId,writing},tx);
    if(!group)throw new ForbiddenException('Không có lớp hành chính trong phạm vi được phép.');
    const records=await this.q(`SELECT r.*,COALESCE(r.learner_code_type_id,t.id) AS learner_code_type_id,t.key AS type_key,t.name AS type_name,t.letter,t.active AS type_active,t.version AS type_version,t.requires_admission,
      EXISTS (SELECT 1 FROM study_leaves pause WHERE pause.admission_record_id=r.id AND pause.status='approved'
        AND pause.start_date <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS effective_study_leave
      FROM admission_records r ${recordTypeJoin}
      WHERE r.id IN (:ids) AND app_record_allowed(r.id,:writing) AND EXISTS(SELECT 1 FROM class_group_members m
        WHERE m.class_group_id=:group AND (m.admission_record_id=r.id OR (r.student_id IS NOT NULL AND m.student_id=r.student_id)))`,
    {ids:dto.recordIds,group:group.id,writing},tx);
    if(records.length!==dto.recordIds.length)throw new ForbiddenException('Danh sách chứa hồ sơ không thuộc lớp hoặc ngoài phạm vi được phép.');
    if(dto.order==='selected')records.sort((a,b)=>dto.recordIds.indexOf(a.id)-dto.recordIds.indexOf(b.id));
    else records.sort((a,b)=>(a.first_name||a.full_name.split(' ').at(-1)).localeCompare(b.first_name||b.full_name.split(' ').at(-1),'vi')
      ||(a.last_name||a.full_name).localeCompare(b.last_name||b.full_name,'vi')||a.id.localeCompare(b.id));
    const rules=await this.q("SELECT * FROM learner_code_rules WHERE active AND effective_from <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date",{},tx);
    const counters=new Map<string,number>(),rows:any[]=[];
    for(const r of records){
      if(r.learner_code_state==='official')throw new ConflictException('Danh sách có hồ sơ đã được cấp mã. Dùng thao tác Đổi mã khi cần.');
      if(!r.type_active||!r.learner_code_type_id||(r.type_key!=='regular'&&!r.letter))throw new BadRequestException('Hồ sơ chưa có loại hợp lệ hoặc loại chưa cấu hình chữ cái.');
      if(r.requires_admission&&!['admitted','approved'].includes(r.status))throw new BadRequestException('Hồ sơ phải được xác nhận trúng tuyển trước khi cấp mã.');
      if(r.effective_study_leave || ['Bảo lưu','Đang bảo lưu','Bảo lưu quá hạn','Thôi học','Đã thôi học'].includes(r.study_status))throw new BadRequestException('Hồ sơ đang bảo lưu hoặc đã thôi học.');
      if(r.major_id!==group.major_id||r.academic_year!==group.academic_year||(r.training_level==='Tiến sĩ'?'doctoral':'masters')!==group.program) {
        throw new ConflictException('Chuyên ngành, năm hoặc bậc hồ sơ không khớp lớp hành chính.');
      }
      const [primary]=await this.q('SELECT app_learner_code_primary_group(:id) AS id',{id:r.id},tx);
      if(primary?.id!==group.id)throw new ConflictException('Hồ sơ cần có đúng một lớp hành chính chính phù hợp trước khi cấp mã.');
      const input={program:group.program,majorId:group.major_id,academicYear:group.academic_year,intakeRound:group.intake_round,
        groupNumber:group.group_number,classGroupId:group.id,typeId:r.learner_code_type_id,abbreviation:group.abbreviation};
      const matches=rules.filter(rule=>(!rule.program||rule.program===input.program)&&(!rule.major_id||rule.major_id===input.majorId)
        &&(!rule.academic_year||rule.academic_year===input.academicYear)&&(!rule.intake_round||rule.intake_round===input.intakeRound)
        &&(!rule.class_group_id||rule.class_group_id===group.id)&&(!rule.type_id||rule.type_id===input.typeId));
      const rank=codeRulePriority;
      matches.sort((a,b)=>rank(b)-rank(a));
      if(!matches.length||(matches[1]&&rank(matches[0])===rank(matches[1])))throw new ConflictException('Không tìm thấy một quy tắc cấp mã duy nhất.');
      const rule=matches[0],key=codeCounterKey(rule.counter_scope,input);
      if(!counters.has(key)){
        const [counter]=await this.q('SELECT next_number FROM learner_code_counters WHERE key=:key',{key},tx);
        counters.set(key,counter?Number(counter.next_number):Number(rule.start_number));
      }
      let n=counters.get(key)!,formatted:any;
      for(;;){
        formatted=formatLearnerCode(rule.parts,input,n,r.letter,dto.manual||'');
        const reserved=await this.q('SELECT 1 FROM learner_code_reservations WHERE code_key=lower(:code)',{code:formatted.code},tx);
        if(!reserved.length&&!rows.some(row=>row.code===formatted.code))break;
        n++;
      }
      counters.set(key,n+1);
      rows.push({id:r.id,fullName:r.full_name,oldCode:r.code,code:formatted.code,typeName:r.type_name,components:formatted.components,
        ruleId:rule.id,ruleVersion:rule.version,typeVersion:r.type_version,recordUpdatedAt:r.updated_at,
        counterKey:key,sequence:n,input,ruleSnapshot:rule,typeLetter:r.letter});
    }
    const result={rows,counters:[...counters].map(([key,nextNumber])=>({key,nextNumber}))};
    return {...result,fingerprint:fingerprint(result)};
  }
  private present(result:any) {
    return {fingerprint:result.fingerprint,rows:result.rows.map((row:any)=>({id:row.id,fullName:row.fullName,
      oldCode:row.oldCode,code:row.code,typeName:row.typeName,components:row.components,ruleVersion:row.ruleVersion}))};
  }
  async preview(actor:any,dto:CodePreviewDto) {
    await this.access(actor,'learnercode.preview');
    return this.db.transaction(async tx=>{
      await this.q('SELECT pg_advisory_xact_lock_shared(74621901)',{},tx);
      await this.q('SELECT pg_advisory_xact_lock_shared(21026)',{},tx);
      return this.present(await this.build(dto,tx));
    });
  }
  private async replay(actor:any,requestId:string,payload:any,tx:Transaction) {
    const [request]=await this.q('SELECT * FROM learner_code_requests WHERE id=:id',{id:requestId},tx);
    if(!request)return null;
    if(request.actor_id!==actor.id||request.profile_id!==workingProfileStorage.getStore()?.roleId||request.fingerprint!==fingerprint(payload)) {
      throw new ConflictException('Khóa chống gửi lặp đã được dùng cho yêu cầu khác.');
    }
    // A retry must never reveal a result after record access has been revoked.
    for(const row of request.result.rows||[]){
      const allowed=await this.q('SELECT id FROM admission_records WHERE id=:id AND app_record_allowed(id,true)',{id:row.id},tx);
      if(!allowed.length)throw new ForbiddenException('Phạm vi hồ sơ đã thay đổi.');
    }
    return request.result;
  }
  private async remember(actor:any,id:string,payload:any,result:any,tx:Transaction) {
    await this.q(`INSERT INTO learner_code_requests(id,actor_id,profile_id,fingerprint,result)
      VALUES(:id,:actor,:profile,:hash,CAST(:result AS jsonb)) RETURNING id`,
    {id,actor:actor.id,profile:workingProfileStorage.getStore()!.roleId,hash:fingerprint(payload),result:JSON.stringify(result)},tx);
  }
  async issue(actor:any,dto:CodeIssueDto) {
    return this.write(actor,'learnercode.issue',async tx=>{
      const previous=await this.replay(actor,dto.requestId,dto,tx);if(previous)return previous;
      const result=await this.build(dto,tx,true);
      if(result.fingerprint!==dto.fingerprint)throw new ConflictException('Bản xem trước đã cũ. Xem trước lại để kiểm tra dải mã mới.');
      await this.q("SELECT set_config('app.learner_code_write','learnercode.issue',true)",{},tx);
      for(const row of result.rows){
        await this.q(`UPDATE admission_records SET intake_code=COALESCE(intake_code,code),code=:code,
          learner_code_type_id=:typeId,learner_code_state='official',updated_at=now() WHERE id=:id RETURNING id`,{id:row.id,code:row.code,typeId:row.input.typeId},tx);
        await this.log(actor,'issue',{code:row.oldCode},row,tx,row.id);
      }
      for(const counter of result.counters)await this.q(`INSERT INTO learner_code_counters(key,next_number) VALUES(:key,:nextNumber)
        ON CONFLICT(key) DO UPDATE SET next_number=EXCLUDED.next_number RETURNING key`,counter,tx);
      const response=this.present(result);
      await this.remember(actor,dto.requestId,dto,response,tx);return response;
    });
  }
  async record(actor:any,id:string,permission='admission.view',tx?:Transaction,writing=false) {
    await this.access(actor,permission,tx);
    const [row]=await this.q(`SELECT r.id,r.code,r.full_name,r.status,r.profile_category,r.intake_code,COALESCE(r.learner_code_type_id,t.id) AS learner_code_type_id,r.learner_code_state,r.updated_at,t.name AS type_name
      FROM admission_records r ${recordTypeJoin} WHERE r.id=:id
      AND (app_record_allowed(r.id,:writing) OR app_admission_unassigned_allowed(r.id,:writing))`,{id,writing},tx);
    if(!row)throw new NotFoundException('Không có hồ sơ trong phạm vi được phép.');
    return {...row,fingerprint:fingerprint(row)};
  }
  async setType(actor:any,id:string,dto:any) {
    const initial=await this.record(actor,id);
    const permission=initial.learner_code_state==='official'?'learnercode.type.change':'learnercode.type.assign';
    return this.write(actor,permission,async tx=>{
      const row=await this.record(actor,id,permission,tx,true);
      const currentPermission=row.learner_code_state==='official'?'learnercode.type.change':'learnercode.type.assign';
      await this.access(actor,currentPermission,tx);
      const [type]=await this.q('SELECT * FROM learner_code_types WHERE id=:id AND active',{id:dto.typeId},tx);
      if(!type)throw new BadRequestException('Loại hồ sơ chưa kích hoạt.');
      await this.q("SELECT set_config('app.learner_code_write',:permission,true)",{permission:currentPermission},tx);
      await this.q('UPDATE admission_records SET learner_code_type_id=:type,updated_at=now() WHERE id=:id RETURNING id',{id,type:dto.typeId},tx);
      await this.log(actor,'type.assign',row,{typeId:dto.typeId,name:type.name,code:row.code},tx,id,dto.reason);
      return {message:'Đã cập nhật loại hồ sơ; mã hiện tại được giữ nguyên.'};
    });
  }
  async reissue(actor:any,id:string,dto:any) {
    return this.write(actor,'learnercode.reissue',async tx=>{
      const replay=await this.replay(actor,dto.requestId,{id,...dto},tx);if(replay)return replay;
      const row=await this.record(actor,id,'learnercode.reissue',tx,true);
      if(row.learner_code_state!=='official')throw new BadRequestException('Hồ sơ chưa có mã chính thức.');
      if(row.fingerprint!==dto.fingerprint)throw new ConflictException('Hồ sơ đã thay đổi. Xem trước lại.');
      const reserved=await this.q('SELECT 1 FROM learner_code_reservations WHERE code_key=lower(:code)',{code:dto.code},tx);
      if(reserved.length)throw new ConflictException('Mã đã được sử dụng hoặc giữ chỗ trong lịch sử.');
      await this.q("SELECT set_config('app.learner_code_write','learnercode.reissue',true)",{},tx);
      await this.q('UPDATE admission_records SET code=:code,updated_at=now() WHERE id=:id RETURNING id',{id,code:dto.code},tx);
      await this.log(actor,'reissue',row,{code:dto.code},tx,id,dto.reason);
      const result={rows:[{id,code:dto.code}]};await this.remember(actor,dto.requestId,{id,...dto},result,tx);return result;
    });
  }
  async history(actor:any,id:string) {
    await this.record(actor,id,'learnercode.history.view');
    return this.q(`SELECT e.*,s.name AS actor_name,p.name AS profile_name FROM learner_code_events e
      JOIN staff s ON s.id=e.actor_id JOIN roles p ON p.id=e.profile_id
      WHERE e.record_id=:id ORDER BY e.created_at DESC LIMIT 200`,{id});
  }
  async advance(actor:any,dto:any) {
    return this.write(actor,'learnercode.counter.advance',async tx=>{
      const [old]=await this.q('SELECT * FROM learner_code_counters WHERE key=:key',{key:dto.key},tx);
      if(!old||dto.nextNumber<=Number(old.next_number))throw new BadRequestException('Chỉ được tăng bộ đếm đã tồn tại.');
      const types=await this.q('SELECT * FROM learner_code_types',{},tx);
      const rules=await this.q("SELECT * FROM learner_code_rules WHERE active AND effective_from <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date",{},tx);
      const maxNumber=codeCounterMaximum(dto.key,types,rules);
      if(dto.nextNumber>maxNumber)throw new BadRequestException(`Số tiếp theo vượt dải cho phép (tối đa ${maxNumber}). Điều chỉnh độ dài quy tắc trước khi tăng bộ đếm.`);
      await this.q('UPDATE learner_code_counters SET next_number=:n WHERE key=:key RETURNING key',{key:dto.key,n:dto.nextNumber},tx);
      await this.log(actor,'counter.advance',old,{...old,next_number:dto.nextNumber},tx,null,dto.reason);
      return {message:'Đã tăng số tiếp theo.'};
    },true);
  }
  async counters(actor:any) {
    await this.access(actor,'learnercode.config.view');
    const [rows,types,rules]=await Promise.all([this.q(`SELECT c.*,t.name AS type_name,g.code AS group_code FROM learner_code_counters c
      LEFT JOIN learner_code_types t ON t.id::text=c.key::jsonb->>2
      LEFT JOIN class_groups g ON c.key::jsonb->>0='class' AND g.id::text=c.key::jsonb->>6 ORDER BY c.key LIMIT 500`),
      this.q('SELECT * FROM learner_code_types'),this.q("SELECT * FROM learner_code_rules WHERE active AND effective_from <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date")]);
    return rows.map(row=>{
      try{return {...row,maxNumber:codeCounterMaximum(row.key,types,rules)};}
      catch{return {...row,maxNumber:null};}
    });
  }
}
