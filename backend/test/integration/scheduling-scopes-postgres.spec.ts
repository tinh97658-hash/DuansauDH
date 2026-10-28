import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { RbacService } from '../../src/auth/rbac.service.js';

const describeDb = process.env.RUN_SCHEDULING_SCOPE_POSTGRES_TESTS === 'true' ? describe : describe.skip;

describeDb('Scheduling grants: PostgreSQL RLS and actual HTTP requests', () => {
  let app: INestApplication;
  let db: Sequelize;
  let tx: Transaction | undefined;
  let actor: string;
  const catalog = { discipline: randomUUID(), major: randomUUID(), subject: randomUUID() };
  const createdPermissions: string[] = [];
  const ids = Object.fromEntries(['staffA', 'staffB', 'staffD', 'roleA', 'roleB', 'roleD', 'viewRole', 'groupA', 'groupB', 'unassigned', 'other', 'offering', 'unrelated', 'room', 'lecturer', 'session', 'recordA', 'recordB'].map(key => [key, randomUUID()]));
  const query = (sql: string, replacements: any = {}) => db.query<any>(sql, { replacements, transaction: tx, type: QueryTypes.SELECT }).catch((error: any) => { throw new Error(error.original?.message || error.message); });
  const resetRole = () => db.query('RESET ROLE', { transaction: tx });
  const scoped = async (staffId = ids.staffA, action = 'write', readOnly = false) => {
    await db.query('SET LOCAL ROLE pgsms_group_scoped', { transaction: tx });
    await query(`SELECT set_config('app.group_staff_id',:staff,true), set_config('app.group_view_restricted','true',true),
      set_config('app.group_edit_restricted','true',true), set_config('app.group_read_only',:readOnly,true),
      set_config('app.scheduling_shared_view','true',true), set_config('app.scheduling_action',:action,true)`,
    { staff: staffId, action, readOnly: String(readOnly) });
  };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.endsWith('/pgsms_group_scope_test')) throw new Error('Use the isolated pgsms_group_scope_test database.');
    app = await NestFactory.create(AppModule, { logger: false });
    db = app.get(getConnectionToken());
    actor = ids.staffA;
    app.use((req: any, _res: any, next: any) => {
      const headerActor = req.headers['x-test-actor'];
      const requestActor = [ids.staffA, ids.staffB, ids.staffD].includes(headerActor) ? headerActor : actor;
      req.user = Staff.build({ id: requestActor, name: 'Scheduling tester', email: `${requestActor}@example.invalid`, role: 'staff', status: 'active', mustChangePassword: false });
      req.isAuthenticated = () => true;
      next();
    });
    // Match main.ts: unknown fields are stripped, so these tests verify that a
    // forged actor/scope/offering cannot affect authorization or session ownership.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    await app.init();
    await db.transaction(async transaction => {
      tx = transaction;
      await query(`INSERT INTO disciplines(id,code,name,created_at,updated_at) VALUES (:id,:code,'Scope discipline',now(),now()) RETURNING id`, { id: catalog.discipline, code: catalog.discipline.slice(0, 8) });
      await query(`INSERT INTO majors(id,discipline_id,code,name,program,created_at,updated_at) VALUES (:id,:discipline,:code,'Scope major','masters',now(),now()) RETURNING id`, { id: catalog.major, discipline: catalog.discipline, code: catalog.major.slice(0, 8) });
      await query(`INSERT INTO subjects(id,major_id,code,name,program,created_at,updated_at) VALUES (:id,:major,:code,'Scope subject','masters',now(),now()) RETURNING id`, { id: catalog.subject, major: catalog.major, code: catalog.subject.slice(0, 8) });
      for (const code of ['scheduling.view', 'scheduling.write', 'scheduling.organize']) {
        const inserted = await query(`INSERT INTO permissions(id,code,name,"group",created_at,updated_at) VALUES (:id,:code,:code,'Scheduling',now(),now()) ON CONFLICT(code) DO NOTHING RETURNING id`, { id: randomUUID(), code });
        createdPermissions.push(...inserted.map(row => row.id));
      }
      for (const suffix of ['A', 'B', 'D']) {
        await query(`INSERT INTO staff(id,name,email,role,status) VALUES (:id,'Scheduling tester',:email,'staff','active') RETURNING id`, { id: ids[`staff${suffix}`], email: `${ids[`staff${suffix}`]}@example.invalid` });
        await query(`INSERT INTO roles(id,code,name,active,scheduling_scope_version,restrict_group_view,restrict_group_edit,created_at,updated_at) VALUES (:id,:id,'Schedule test',true,1,:restricted,:restricted,now(),now()) RETURNING id`, { id: ids[`role${suffix}`], restricted: true });
        await query(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES (:staff,:role,now(),now()) RETURNING staff_id`, { staff: ids[`staff${suffix}`], role: ids[`role${suffix}`] });
        await query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
          SELECT :role,id,now(),now() FROM permissions WHERE code IN ('scheduling.view','scheduling.write') RETURNING role_id`, { role: ids[`role${suffix}`] });
        await query(`INSERT INTO role_permission_scopes(role_id,permission_id,scope)
          SELECT :role,id,:scope FROM permissions WHERE code IN ('scheduling.view','scheduling.write') RETURNING role_id`, { role: ids[`role${suffix}`], scope: suffix === 'D' ? 'institution' : 'related_offerings' });
      }
      await query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT :role,id,now(),now() FROM permissions WHERE code IN ('gradebook.view','gradebook.submit','studyleave.manage') RETURNING role_id`, { role: ids.roleD });
      for (const [key, staff] of [['groupA', ids.staffA], ['groupB', ids.staffB], ['unassigned', null], ['other', null]]) {
        await query(`INSERT INTO class_groups(id,program,code,name,academic_year,responsible_staff_id,created_at,updated_at)
          VALUES (:id,'masters',:id,:id,'2099',:staff,now(),now()) RETURNING id`, { id: ids[key as string], staff });
      }
      for (const key of ['offering', 'unrelated']) {
        await query(`INSERT INTO course_offerings(id,subject_id,name,created_at,updated_at) VALUES (:id,:subject,'Scope test',now(),now()) RETURNING id`, { id: ids[key], subject: catalog.subject });
      }
      for (const key of ['groupA', 'groupB', 'unassigned', 'other']) {
        await query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at) VALUES (:id,:offering,:group,now(),now()) RETURNING id`, { id: randomUUID(), offering: key === 'other' ? ids.unrelated : ids.offering, group: ids[key] });
      }
      for (const suffix of ['A', 'B']) {
        await query(`INSERT INTO admission_records(id,code,full_name,training_level,academic_year,created_at,updated_at) VALUES (:id,:id,'Private learner','Thạc sĩ','2099',now(),now()) RETURNING id`, { id: ids[`record${suffix}`] });
        await query(`INSERT INTO class_group_members(id,class_group_id,admission_record_id,enrolled_at,created_at,updated_at) VALUES (:id,:group,:record,'2019-01-01',now(),now()) RETURNING id`, { id: randomUUID(), group: ids[`group${suffix}`], record: ids[`record${suffix}`] });
      }
      await query(`INSERT INTO rooms(id,code,name,capacity,is_active,created_at,updated_at) VALUES (:id,:code,'Scope room',50,true,now(),now()) RETURNING id`, { id: ids.room, code: `S${ids.room.slice(0, 8)}` });
      await query(`INSERT INTO lecturers(id,code,name,active,created_at,updated_at) VALUES (:id,:code,'Scope lecturer',true,now(),now()) RETURNING id`, { id: ids.lecturer, code: `S${ids.lecturer.slice(0, 8)}` });
      await query(`INSERT INTO teaching_sessions(id,course_offering_id,session_date,start_time,end_time,period,room_id,lecturer_id,created_at,updated_at)
        VALUES (:id,:offering,'2099-01-05','07:00','12:00','MORNING',:room,:lecturer,now(),now()) RETURNING id`, { id: ids.session, offering: ids.unrelated, room: ids.room, lecturer: ids.lecturer });
    });
    tx = undefined;
  });
  beforeEach(async () => { tx = await db.transaction(); actor = ids.staffA; app.get(RbacService).invalidate(); });
  afterEach(async () => { if (tx && !(tx as any).finished) await tx.rollback(); tx = undefined; });
  afterAll(async () => {
    tx = undefined;
    if (db) {
      await query('DELETE FROM teaching_sessions WHERE course_offering_id IN (:ids)', { ids: [ids.offering, ids.unrelated] });
      await query('DELETE FROM gradebook_events WHERE course_offering_id IN (:ids)', { ids: [ids.offering, ids.unrelated] });
      await query('DELETE FROM course_exam_gradebooks WHERE course_offering_id IN (:ids)', { ids: [ids.offering, ids.unrelated] });
      await query('DELETE FROM course_offerings WHERE id IN (:ids)', { ids: [ids.offering, ids.unrelated] });
      await query('DELETE FROM class_group_members WHERE class_group_id IN (:ids)', { ids: [ids.groupA, ids.groupB, ids.unassigned, ids.other] });
      await query('DELETE FROM class_groups WHERE id IN (:ids)', { ids: [ids.groupA, ids.groupB, ids.unassigned, ids.other] });
      await query('DELETE FROM admission_records WHERE id IN (:ids)', { ids: [ids.recordA, ids.recordB] });
      await query('DELETE FROM staff_roles WHERE staff_id IN (:ids)', { ids: [ids.staffA, ids.staffB, ids.staffD] });
      await query('DELETE FROM role_permissions WHERE role_id IN (:ids)', { ids: [ids.roleA, ids.roleB, ids.roleD, ids.viewRole] });
      await query('DELETE FROM roles WHERE id IN (:ids)', { ids: [ids.roleA, ids.roleB, ids.roleD, ids.viewRole] });
      await query('DELETE FROM auth_audit_logs WHERE actor_staff_id IN (:ids)', { ids: [ids.staffA, ids.staffB, ids.staffD] });
      await query('DELETE FROM staff WHERE id IN (:ids)', { ids: [ids.staffA, ids.staffB, ids.staffD] });
      await query('DELETE FROM rooms WHERE id=:id', { id: ids.room });
      await query('DELETE FROM lecturers WHERE id=:id', { id: ids.lecturer });
      await query('DELETE FROM subjects WHERE id=:id', { id: catalog.subject });
      await query('DELETE FROM majors WHERE id=:id', { id: catalog.major });
      await query('DELETE FROM disciplines WHERE id=:id', { id: catalog.discipline });
      if (createdPermissions.length) await query('DELETE FROM permissions WHERE id IN (:ids)', { ids: createdPermissions });
    }
    await app?.close();
  });

  it('allows A and B to write their shared timetable, including the unassigned group', async () => {
    for (const staff of [ids.staffA, ids.staffB]) {
      await scoped(staff);
      expect(await query('SELECT app_schedule_allowed(:id,\'scheduling.write\') AS allowed', { id: ids.offering })).toEqual([{ allowed: true }]);
      expect(await query("UPDATE course_offerings SET updated_at=now() WHERE id=:id RETURNING id", { id: ids.offering })).toHaveLength(1);
      expect(await query('SELECT * FROM app_schedule_groups(:id)', { id: ids.offering })).toHaveLength(3);
      expect(await query('SELECT app_schedule_count(:id) AS count', { id: ids.offering })).toEqual([{ count: 2 }]);
      await resetRole();
    }
  });
  it('allows institution timetable writes without granting organization or profile access', async () => {
    await scoped();
    expect(await query("UPDATE course_offerings SET updated_at=now() WHERE id=:id RETURNING id", { id: ids.unrelated })).toHaveLength(1);
    expect(await query('DELETE FROM course_offerings WHERE id=:id RETURNING id', { id: ids.offering })).toHaveLength(0);
    expect(await query('DELETE FROM course_offering_class_groups WHERE course_offering_id=:id RETURNING id', { id: ids.offering })).toHaveLength(0);
    expect(await query('SELECT id FROM admission_records WHERE id=:id', { id: ids.recordB })).toHaveLength(0);
    expect(await query('SELECT app_offering_allowed(:id,true) AS allowed', { id: ids.offering })).toEqual([{ allowed: false }]);
  });
  it('allows institution scheduling without assignments and keeps profiles restricted', async () => {
    await scoped(ids.staffD);
    expect(await query("UPDATE course_offerings SET updated_at=now() WHERE id IN (:ids) RETURNING id", { ids: [ids.offering, ids.unrelated] })).toHaveLength(2);
    expect(await query('SELECT id FROM admission_records WHERE id IN (:ids)', { ids: [ids.recordA, ids.recordB] })).toHaveLength(0);
  });
  it('read-only wins over institution grants', async () => {
    await scoped(ids.staffD, 'write', true);
    expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: ids.offering })).toHaveLength(1);
    expect(await query("UPDATE course_offerings SET updated_at=now() WHERE id=:id RETURNING id", { id: ids.offering })).toHaveLength(0);
  });
  it('automatically promotes granted write scope without a client scope choice', async () => {
    await query(`UPDATE role_permission_scopes SET scope='institution' WHERE role_id=:role AND permission_id=(SELECT id FROM permissions WHERE code='scheduling.view') RETURNING role_id`, { role: ids.roleA });
    await scoped();
    expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: ids.unrelated })).toHaveLength(1);
    expect(await query("UPDATE course_offerings SET updated_at=now() WHERE id=:id RETURNING id", { id: ids.unrelated })).toHaveLength(1);
  });
  it('permission revocation and inactive roles deny subsequent statements', async () => {
    await query('DELETE FROM role_permissions WHERE role_id=:role RETURNING role_id', { role: ids.roleA });
    await scoped();
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.write') AS allowed", { id: ids.offering })).toEqual([{ allowed: false }]);
    await resetRole();
    await query('UPDATE roles SET active=false WHERE id=:id RETURNING id', { id: ids.roleD });
    await scoped(ids.staffD);
    expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: ids.offering })).toHaveLength(0);
  });
  it('ignores group assignments but rechecks read-only roles from the database', async () => {
    await query('UPDATE class_groups SET responsible_staff_id=:staff WHERE id=:id RETURNING id', { id: ids.groupA, staff: ids.staffB });
    await scoped();
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.write') AS allowed", { id: ids.offering })).toEqual([{ allowed: true }]);
    await resetRole();
    await query('UPDATE roles SET group_read_only=true WHERE id=:id RETURNING id', { id: ids.roleD });
    await scoped(ids.staffD, 'write', false);
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.write') AS allowed", { id: ids.offering })).toEqual([{ allowed: false }]);
  });
  it('detects busy resources outside view scope without returning hidden session data', async () => {
    await scoped();
    expect(await query('SELECT id FROM teaching_sessions WHERE id=:id', { id: ids.session })).toHaveLength(1);
    expect(await query("SELECT app_schedule_conflict(:offering,'2099-01-05','MORNING',:room,:lecturer,NULL) AS conflict", { offering: ids.offering, room: ids.room, lecturer: ids.lecturer })).toEqual([{ conflict: 'ROOM_CONFLICT' }]);
    expect(await query("SELECT app_schedule_conflict(:offering,'2099-01-05','MORNING',:room,:lecturer,NULL) AS conflict", { offering: ids.offering, room: randomUUID(), lecturer: ids.lecturer })).toEqual([{ conflict: 'LECTURER_CONFLICT' }]);
  });
  it('detects shared learners outside view scope without exposing identities', async () => {
    await query(`INSERT INTO course_offering_students(id,course_offering_id,admission_record_id,created_at,updated_at) VALUES (:id,:offering,:record,now(),now()) RETURNING id`, { id: randomUUID(), offering: ids.unrelated, record: ids.recordB });
    await scoped();
    expect(await query("SELECT app_schedule_conflict(:offering,'2099-01-05','MORNING',:room,:lecturer,NULL) AS conflict", { offering: ids.offering, room: randomUUID(), lecturer: randomUUID() })).toEqual([{ conflict: 'STUDENT_CONFLICT' }]);
  });
  it('allows every institution offering independently of group membership', async () => {
    await query('UPDATE course_offering_class_groups SET class_group_id=:group WHERE course_offering_id=:offering RETURNING id', { group: ids.groupB, offering: ids.unrelated });
    await scoped();
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.write') AS allowed", { id: ids.unrelated })).toEqual([{ allowed: true }]);
    expect(await query("SELECT app_schedule_conflict(:offering,'2099-01-05','MORNING',:room,:lecturer,NULL) AS conflict", { offering: ids.offering, room: randomUUID(), lecturer: randomUUID() })).toEqual([{ conflict: 'CLASS_GROUP_CONFLICT' }]);
  });
  it('organizes institution groups when the separate organization action is granted', async () => {
    await query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT :role,id,now(),now() FROM permissions WHERE code='scheduling.organize' RETURNING role_id`, { role: ids.roleA });
    await query(`INSERT INTO role_permission_scopes(role_id,permission_id,scope) SELECT :role,id,'assigned_groups' FROM permissions WHERE code='scheduling.organize' RETURNING role_id`, { role: ids.roleA });
    await scoped(ids.staffA, 'organize');
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.organize') AS allowed", { id: ids.offering })).toEqual([{ allowed: true }]);
    const createdId = randomUUID();
    await query(`INSERT INTO course_offerings(id,subject_id,created_at,updated_at) VALUES (:id,:subject,now(),now()) RETURNING id`, { id: createdId, subject: catalog.subject });
    expect(await query("SELECT scope_created_by_staff_id, app_schedule_allowed(id,'scheduling.organize') AS allowed, app_schedule_group_allowed(:group,true) AS group_allowed FROM course_offerings WHERE id=:id", { id: createdId, group: ids.groupA })).toEqual([{ scope_created_by_staff_id: ids.staffA, allowed: true, group_allowed: true }]);
    await query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at) VALUES (:id,:offering,:group,now(),now()) RETURNING id`, { id: randomUUID(), offering: createdId, group: ids.groupA });
    expect(await query("SELECT app_schedule_allowed(:id,'scheduling.organize') AS allowed", { id: createdId })).toEqual([{ allowed: true }]);
    await expect(db.transaction({ transaction: tx }, async savepoint => {
      await db.query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at) VALUES (:id,:offering,:group,now(),now())`, {
        replacements: { id: randomUUID(), offering: createdId, group: ids.groupB }, transaction: savepoint,
      });
    })).resolves.toBeUndefined();
    expect(await query('SELECT class_group_id FROM course_offering_class_groups WHERE course_offering_id=:id', { id: createdId })).toEqual(expect.arrayContaining([{ class_group_id: ids.groupA }, { class_group_id: ids.groupB }]));
  });
  it('blocks changing grade data through a scheduling UPDATE even for allowed offerings', async () => {
    await scoped();
    await expect(db.transaction({ transaction: tx }, async savepoint => {
      await db.query("UPDATE course_offerings SET gradebook_snapshot='[]'::jsonb WHERE id=:id", { replacements: { id: ids.offering }, transaction: savepoint });
    })).rejects.toThrow();
  });
  it('organization institution reads its roster and records retakes without legacy group assignments', async () => {
    await query(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT :role,id,now(),now() FROM permissions WHERE code='scheduling.organize' RETURNING role_id`, { role: ids.roleD });
    await query(`INSERT INTO role_permission_scopes(role_id,permission_id,scope) SELECT :role,id,'institution' FROM permissions WHERE code='scheduling.organize' RETURNING role_id`, { role: ids.roleD });
    await scoped(ids.staffD, 'view');
    expect(await query('SELECT id FROM class_group_members WHERE class_group_id IN (:ids)', { ids: [ids.groupA, ids.groupB] })).toHaveLength(2);
    expect(await query('SELECT id FROM admission_records WHERE id IN (:ids)', { ids: [ids.recordA, ids.recordB] })).toHaveLength(2);
    await query("SELECT set_config('app.scheduling_action','organize',true)");
    await query(`INSERT INTO scheduling_retakes(id,admission_record_id,subject_id,source_course_offering_id,created_at)
      VALUES (:id,:record,:subject,:source,now()) RETURNING id`, { id: randomUUID(), record: ids.recordA, subject: catalog.subject, source: ids.offering });
  });
  it('cannot reuse unrestricted legacy flags to write profiles or enrollment from a timetable request', async () => {
    await scoped(ids.staffD);
    await query("SELECT set_config('app.group_view_restricted','false',true),set_config('app.group_edit_restricted','false',true)");
    expect(await query("UPDATE admission_records SET full_name='forbidden' WHERE id=:id RETURNING id", { id: ids.recordA })).toHaveLength(0);
    expect(await query('UPDATE class_groups SET responsible_staff_id=:staff WHERE id=:id RETURNING id', { id: ids.groupA, staff: ids.staffD })).toHaveLength(0);
    await expect(db.transaction({ transaction: tx }, async savepoint => {
      await db.query(`INSERT INTO course_offering_students(id,course_offering_id,admission_record_id,created_at,updated_at)
        VALUES (:id,:offering,:record,now(),now())`, { replacements: { id: randomUUID(), offering: ids.offering, record: ids.recordA }, transaction: savepoint });
    })).rejects.toThrow();
  });
  it('institution scheduling remains limited to supported training programs in raw SQL', async () => {
    const doctoralSubject = randomUUID();
    const doctoralOffering = randomUUID();
    await query(`INSERT INTO subjects(id,major_id,code,name,program,created_at,updated_at) VALUES (:id,:major,:code,'Unsupported program','doctoral',now(),now()) RETURNING id`, { id: doctoralSubject, major: catalog.major, code: doctoralSubject.slice(0, 8) });
    await query(`INSERT INTO course_offerings(id,subject_id,created_at,updated_at) VALUES (:id,:subject,now(),now()) RETURNING id`, { id: doctoralOffering, subject: doctoralSubject });
    await scoped(ids.staffD);
    expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: doctoralOffering })).toHaveLength(0);
    expect(await query('UPDATE course_offerings SET updated_at=now() WHERE id=:id RETURNING id', { id: doctoralOffering })).toHaveLength(0);
  });
  it('uses actual HTTP policy for detail, creation, conflict, direct IDs and organization', async () => {
    const detail = await request(app.getHttpServer()).get(`/scheduling/course-offerings/${ids.offering}`).expect(200);
    expect(detail.body).toMatchObject({ canWriteSchedule: true, canOrganize: false, participantCount: 2 });
    expect(detail.body).not.toHaveProperty('gradebookSnapshot');
    expect(detail.body.groupLinks.every((link: any) => !('participantIds' in link))).toBe(true);
    expect(detail.body.groupLinks.every((link: any) => !link.classGroup || !('note' in link.classGroup))).toBe(true);
    await request(app.getHttpServer()).get(`/scheduling/course-offerings/${ids.unrelated}`).expect(200);
    await request(app.getHttpServer()).delete(`/scheduling/course-offerings/${ids.offering}`).expect(403);
    const payload = { courseOfferingId: ids.offering, sessionDate: '2099-01-05', startTime: '07:00', endTime: '12:00', period: 'MORNING', roomId: ids.room, lecturerId: ids.lecturer };
    await request(app.getHttpServer()).post('/scheduling/teaching-sessions').send({ ...payload, courseOfferingId: ids.unrelated, scope: 'institution', actor: ids.staffD }).expect(409);
    const conflict = await request(app.getHttpServer()).post('/scheduling/teaching-sessions').send(payload).expect(409);
    expect(conflict.body.code).toBe('ROOM_CONFLICT');
    expect(conflict.body).not.toHaveProperty('details');
    const foreign = await request(app.getHttpServer()).post('/scheduling/teaching-sessions').send({ ...payload, courseOfferingId: ids.unrelated, sessionDate: '2099-01-07' }).expect(201);
    await request(app.getHttpServer()).delete(`/scheduling/teaching-sessions/${foreign.body.id}`).expect(200);
    const created = await request(app.getHttpServer()).post('/scheduling/teaching-sessions').send({ ...payload, sessionDate: '2099-01-06' }).expect(201);
    expect(created.body.courseOfferingId).toBe(ids.offering);
    const unchangedOwner = await request(app.getHttpServer()).put(`/scheduling/teaching-sessions/${created.body.id}`).send({ courseOfferingId: ids.unrelated }).expect(200);
    expect(unchangedOwner.body.courseOfferingId).toBe(ids.offering);
    await request(app.getHttpServer()).delete(`/scheduling/teaching-sessions/${created.body.id}`).expect(200);
    actor = ids.staffD;
    const institution = await request(app.getHttpServer()).get(`/scheduling/course-offerings/${ids.unrelated}`).expect(200);
    expect(institution.body.canWriteSchedule).toBe(true);
    await request(app.getHttpServer()).get('/masters/exam-lists/options').set('x-test-actor', ids.staffA).expect(403);
  });
  it('reads institution grade rosters with no group assignment and keeps approval independent', async () => {
    const options = await request(app.getHttpServer()).get('/masters/exam-lists/options').set('x-test-actor',ids.staffD).expect(200);
    expect(options.body.groups.map((g:any)=>g.id)).toEqual(expect.arrayContaining([ids.groupA,ids.groupB,ids.other]));
    expect(options.body.courseOfferings.map((o:any)=>o.id)).toEqual(expect.arrayContaining([ids.offering,ids.unrelated]));
    const parameters={classGroupId:ids.groupA,courseOfferingId:ids.offering,rosterScope:'offering'};
    const roster=await request(app.getHttpServer()).get('/masters/exam-lists').query(parameters).set('x-test-actor',ids.staffD).expect(200);
    expect(roster.body.totalRows).toBe(2);
    await request(app.getHttpServer()).post('/masters/exam-lists/eligibility/workflow').set('x-test-actor',ids.staffD)
      .send({...parameters,action:'approve',revision:0,version:0,note:'Forbidden'}).expect(403);
    await request(app.getHttpServer()).get('/masters/exam-schedule').query({from:'2099-01-01',to:'2099-01-07'}).set('x-test-actor',ids.staffA).expect(200);
  });
  it('writes grades for an unassigned group while preventing profile, teaching and approval changes', async () => {
    await scoped(ids.staffD,'');
    await query("SELECT set_config('app.academic_domain','gradebook',true),set_config('app.academic_permission','gradebook.submit',true)");
    expect(await query('SELECT id FROM class_groups WHERE id=:id FOR UPDATE',{id:ids.groupB})).toHaveLength(1);
    expect(await query('SELECT id FROM course_offerings WHERE id=:id FOR UPDATE',{id:ids.offering})).toHaveLength(1);
    await query('INSERT INTO course_exam_workflows(course_offering_id) VALUES(:id) RETURNING course_offering_id',{id:ids.offering});
    expect(await query(`INSERT INTO course_exam_gradebooks(id,class_group_id,course_offering_id,revision,grades,created_at,updated_at)
      VALUES(:id,:group,:offering,1,'[]'::jsonb,now(),now()) RETURNING id`,{id:randomUUID(),group:ids.groupB,offering:ids.offering})).toHaveLength(1);
    for(const sql of ["UPDATE course_exam_workflows SET eligibility_status='approved' WHERE course_offering_id=:id",
      "UPDATE course_offerings SET name='forged' WHERE id=:id", "UPDATE class_groups SET name='forged' WHERE id=:group",
      "UPDATE admission_records SET full_name='forged' WHERE id=:record RETURNING id"]){
      const result=await db.transaction({transaction:tx},savepoint=>db.query(sql,{replacements:{id:ids.offering,group:ids.groupB,record:ids.recordB},transaction:savepoint})).then(value=>value,()=>null);
      if(sql.includes('admission_records')) expect(result?.[0]).toEqual([]); else expect(result).toBeNull();
    }
    await query("SELECT set_config('app.group_read_only','true',true)");
    expect(await query('UPDATE course_exam_gradebooks SET revision=2 WHERE course_offering_id=:id RETURNING id',{id:ids.offering})).toHaveLength(0);
  });
  it('serializes A and B scheduling the same shared resource concurrently', async () => {
    const payload = { courseOfferingId: ids.offering, sessionDate: '2099-02-03', startTime: '07:00', endTime: '12:00', period: 'MORNING', roomId: ids.room, lecturerId: ids.lecturer };
    const responses = await Promise.all([ids.staffA, ids.staffB].map(staff =>
      request(app.getHttpServer()).post('/scheduling/teaching-sessions').set('x-test-actor', staff).send(payload)));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const created = responses.find(response => response.status === 201)!;
    expect(await query("SELECT id FROM teaching_sessions WHERE course_offering_id=:id AND session_date='2099-02-03'", { id: ids.offering })).toHaveLength(1);
    await request(app.getHttpServer()).delete(`/scheduling/teaching-sessions/${created.body.id}`).expect(200);
  });
  it('completes a shared offering only after explicitly handling its three unresolved sessions', async () => {
    await db.query(`INSERT INTO teaching_sessions(id,course_offering_id,session_date,start_time,end_time,period,room_id,lecturer_id,status,confirmed_at,confirmed_by_staff_id,created_at,updated_at)
      VALUES (:id,:offering,'2020-01-05','07:00','12:00','MORNING',:room,:lecturer,'held',now(),:actor,now(),now())`, {
      replacements: { id: randomUUID(), offering: ids.offering, room: ids.room, lecturer: ids.lecturer, actor: ids.staffA }, transaction: null,
    }).catch((error: any) => { throw new Error(error.original?.message || error.message); });
    const plannedIds: string[] = [];
    for (const day of ['2099-01-06', '2099-01-07', '2099-01-08']) {
      const created = await request(app.getHttpServer()).post('/scheduling/teaching-sessions').send({ courseOfferingId: ids.offering, sessionDate: day, startTime: '07:00', endTime: '12:00', period: 'MORNING', roomId: ids.room, lecturerId: ids.lecturer }).expect(201);
      plannedIds.push(created.body.id);
    }
    const detail = await request(app.getHttpServer()).get(`/scheduling/course-offerings/${ids.offering}`).expect(200);
    expect(detail.body).toMatchObject({ canWriteSchedule: true, canCompleteTeaching: true, sessionSummary: { heldCount: 1, plannedCount: 3 } });
    const blocked = await request(app.getHttpServer()).put(`/scheduling/course-offerings/${ids.offering}/completion`).send({}).expect(409);
    expect(blocked.body.code).toBe('UNRESOLVED_SESSIONS');
    await request(app.getHttpServer()).put(`/scheduling/course-offerings/${ids.offering}/completion`).send({ cancelPlannedSessions: true, expectedPlannedSessionIds: plannedIds.slice(0, 2) }).expect(409);
    expect((await query('SELECT id FROM teaching_sessions WHERE course_offering_id=:id AND status=\'planned\'', { id: ids.offering }))).toHaveLength(3);
    const completed = await request(app.getHttpServer()).put(`/scheduling/course-offerings/${ids.offering}/completion`).send({ cancelPlannedSessions: true, expectedPlannedSessionIds: plannedIds }).expect(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body).not.toHaveProperty('gradebookSnapshot');
    const parameters={classGroupId:ids.groupA,courseOfferingId:ids.offering,rosterScope:'offering'};
    const book=await request(app.getHttpServer()).get('/masters/exam-lists').query(parameters).set('x-test-actor',ids.staffD).expect(200);
    const rows=book.body.rows.map((r:any)=>({participantId:r.participantId,testScore:8,assignmentScore:8,examScore:null,
      examExempt:false,letterGrade:'',attemptScores:[],result:'pending',policyVersion:r.eligibilityPolicy.version,policyRulesVersion:r.eligibilityPolicy.rulesVersion}));
    const saved=await request(app.getHttpServer()).put('/masters/exam-lists').set('x-test-actor',ids.staffD)
      .send({...parameters,revision:book.body.revision,rows});
    expect({status:saved.status,body:saved.status===200?null:saved.body}).toEqual({status:200,body:null});
    expect(saved.body.rows).toHaveLength(2);
    expect(saved.body.rows.every((row:any)=>row.testScore===8)).toBe(true);
    await db.query('UPDATE roles SET group_read_only=true WHERE id=:id',{replacements:{id:ids.roleD},transaction:null});
    try {
      await request(app.getHttpServer()).put('/masters/exam-lists').set('x-test-actor',ids.staffD)
        .send({...parameters,revision:saved.body.revision,rows}).expect(403);
    } finally { await db.query('UPDATE roles SET group_read_only=false WHERE id=:id',{replacements:{id:ids.roleD},transaction:null}); }

    expect(await query(`SELECT actor_staff_id FROM auth_audit_logs WHERE actor_staff_id=:actor AND action='scheduling.course_offerings.update' AND metadata->>'statusAfter'='completed'`, { actor: ids.staffA })).toEqual([{ actor_staff_id: ids.staffA }]);
  });
});
