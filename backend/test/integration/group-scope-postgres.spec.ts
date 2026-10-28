import { profileForeignLanguageExemptSql } from "../../src/masters/foreign-language-exemption.js";
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RbacService } from '../../src/auth/rbac.service.js';
import { CourseOffering } from "../../src/database/models/training/course-offering.model.js";
import { ClassGroup } from "../../src/database/models/training/class-group.model.js";
import { Staff } from '../../src/database/models/staff.model.js';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { AppModule } from '../../src/app.module.js';
import { GroupScopeService } from '../../src/auth/group-scope.service.js';
import { Discipline } from '../../src/database/models/common/discipline.model.js';
import { Major } from '../../src/database/models/common/major.model.js';
import { Subject } from '../../src/database/models/plan/subject.model.js';
import { Room } from '../../src/database/models/common/room.model.js';
import { Lecturer } from '../../src/database/models/common/lecturer.model.js';
import { TeachingSession } from '../../src/database/models/training/teaching-session.model.js';

const describeDb = process.env.RUN_GROUP_SCOPE_POSTGRES_TESTS === 'true' ? describe : describe.skip;

describeDb('Group scope through PostgreSQL and pooled queries', () => {
  let app: INestApplication;
  let httpAccess: any;
  let db: Sequelize;
  let scope: GroupScopeService;
  let tx: Transaction;
  let staffId: string;
  let owned: string;
  let other: string;
  let unassigned: string;
  let ownedRecord: string;
  let otherRecord: string;
  const catalogIds = { discipline: randomUUID(), major: randomUUID(), english: randomUUID(), subject: randomUUID() };
  const flags = (restrictView = false, restrictEdit = false, readOnly = false) => ({
    permissions: new Set<string>(), roleCodes: [], groupScope: { restrictView, restrictEdit, readOnly },
  });
  const query = (sql: string, replacements: any = {}) => db.query<any>(sql, { replacements, transaction: tx, type: QueryTypes.SELECT }).catch((error: any) => { throw new Error(error.original?.message || error.message); });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.endsWith('/pgsms_group_scope_test')) throw new Error('Use the isolated pgsms_group_scope_test database.');
    process.env.NODE_ENV = 'test';
    app = await NestFactory.create(AppModule, { logger: false });
    db = app.get(getConnectionToken()); scope = app.get(GroupScopeService);
    app.use((req: any, _res: any, next: any) => {
      req.user = Staff.build({ id: staffId, name: 'Scope tester', email: `${staffId}@example.invalid`, role: 'admin', status: 'active', mustChangePassword: false });
      req.isAuthenticated = () => true;
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await Discipline.create({ id: catalogIds.discipline, code: `S${catalogIds.discipline.slice(0, 8)}`, name: 'Scope test discipline' });
    await Major.create({ id: catalogIds.major, disciplineId: catalogIds.discipline, code: `S${catalogIds.major.slice(0, 8)}`, name: 'Scope test major', program: 'masters' });
    for (const [id, name] of [[catalogIds.english, 'Tiếng Anh'], [catalogIds.subject, 'Scope test subject']]) {
      await Subject.create({ id, code: `S${id.slice(0, 8)}`, name, majorId: catalogIds.major, program: 'masters' });
    }
  });
  beforeEach(async () => {
    jest.spyOn(app.get(RbacService), "effectiveAccess").mockImplementation(async () => httpAccess);
    tx = await db.transaction();
    staffId = randomUUID(); owned = randomUUID(); other = randomUUID(); unassigned = randomUUID();
    ownedRecord = randomUUID(); otherRecord = randomUUID();
    await query(`INSERT INTO staff(id,name,email,role) VALUES (:staffId,'Scope tester',:email,'admin') RETURNING id`, { staffId, email: `${staffId}@example.invalid` });
    for (const [id, responsible] of [[owned, staffId], [other, null], [unassigned, null]]) {
      await query(`INSERT INTO class_groups(id,program,code,name,academic_year,responsible_staff_id,created_at,updated_at)
        VALUES (:id,'masters',:id,:id,'2026',:responsible,now(),now()) RETURNING id`, { id, responsible });
    }
    for (const [id, groupId] of [[ownedRecord, owned], [otherRecord, other]]) {
      await query(`INSERT INTO admission_records(id,code,full_name,training_level,academic_year,created_at,updated_at)
        VALUES (:id,:id,'Scope learner','Thạc sĩ','2026',now(),now()) RETURNING id`, { id });
      await query(`INSERT INTO class_group_members(id,class_group_id,admission_record_id,created_at,updated_at)
        VALUES (:memberId,:groupId,:id,now(),now()) RETURNING id`, { memberId: randomUUID(), groupId, id });
    }
  });
  afterEach(async () => {
    if (!(tx as any).finished) await tx.rollback();
    else {
      await db.query('DELETE FROM class_group_members WHERE class_group_id IN (:ids)', { replacements: { ids: [owned, other, unassigned] } });
      await db.query('DELETE FROM admission_records WHERE id IN (:ids)', { replacements: { ids: [ownedRecord, otherRecord] } });
      await db.query('DELETE FROM class_groups WHERE id IN (:ids)', { replacements: { ids: [owned, other, unassigned] } });
      await db.query('DELETE FROM staff WHERE id=:id', { replacements: { id: staffId } });
    }
  });
  afterAll(async () => {
    if (db) {
      await Subject.destroy({ where: { id: [catalogIds.english, catalogIds.subject] } });
      await Major.destroy({ where: { id: catalogIds.major } });
      await Discipline.destroy({ where: { id: catalogIds.discipline } });
    }
    await app?.close();
  });

  it('does not restrict an employee until a lock is enabled', async () => {
    const rows = await scope.run(staffId, flags(), () => query('SELECT id FROM class_groups WHERE id IN (:ids)', { ids: [owned, other, unassigned] }));
    expect(rows).toHaveLength(3);
    const updated = await scope.run(staffId, flags(), () => query(`UPDATE class_groups SET note='allowed' WHERE id=:other RETURNING id`, { other }));
    expect(updated).toHaveLength(1);
  });

  it('filters raw lists, learner records, views and direct IDs when view lock is enabled', async () => {
    await scope.run(staffId, flags(true), async () => {
      expect(await query('SELECT id FROM class_groups WHERE id IN (:ids)', { ids: [owned, other, unassigned] })).toEqual([{ id: owned }]);
      expect(await query('SELECT id FROM admission_records WHERE id IN (:ids)', { ids: [ownedRecord, otherRecord] })).toEqual([{ id: ownedRecord }]);
      expect(await query('SELECT * FROM academic_class_members WHERE class_group_id=:other', { other })).toHaveLength(0);
      expect(await query('SELECT * FROM v_class_lists WHERE class_group_id=:owned', { owned })).toHaveLength(1);
      expect(await query('SELECT * FROM v_class_lists WHERE class_group_id=:other', { other })).toHaveLength(0);
      expect(await query('SELECT id FROM class_groups WHERE id=:other', { other })).toHaveLength(0);
    });
  });

  it('allows viewing all groups while independently locking edits to assigned groups', async () => {
    await scope.run(staffId, flags(false, true), async () => {
      expect(await query('SELECT id FROM class_groups WHERE id IN (:ids)', { ids: [owned, other] })).toHaveLength(2);
      expect(await query(`UPDATE class_groups SET note='blocked' WHERE id=:other RETURNING id`, { other })).toHaveLength(0);
      expect(await query(`UPDATE admission_records SET note='blocked' WHERE id=:otherRecord RETURNING id`, { otherRecord })).toHaveLength(0);
      expect(await query(`UPDATE class_groups SET note='allowed' WHERE id=:owned RETURNING id`, { owned })).toHaveLength(1);
    });
  });

  it('read-only wins even for the assigned employee and leaves reads available', async () => {
    await scope.run(staffId, flags(false, false, true), async () => {
      expect(await query('SELECT id FROM class_groups WHERE id=:owned', { owned })).toHaveLength(1);
      expect(await query(`UPDATE class_groups SET note='blocked' WHERE id=:owned RETURNING id`, { owned })).toHaveLength(0);
      expect(await query(`DELETE FROM class_group_members WHERE class_group_id=:owned RETURNING id`, { owned })).toHaveLength(0);
    });
  });

  it('cannot steal another group by changing its responsible employee', async () => {
    await scope.run(staffId, flags(false, true), async () => {
      expect(await query('UPDATE class_groups SET responsible_staff_id=:staffId WHERE id=:other RETURNING id', { staffId, other })).toHaveLength(0);
    });
  });

  it('isolates autocommit requests and returns the original role to pooled connections', async () => {
    // Fixtures are intentionally uncommitted and cannot appear on other pool connections.
    const rows = await scope.run(staffId, flags(true), () => db.query<any>('SELECT current_user AS username', { type: QueryTypes.SELECT }));
    expect(rows[0].username).toBe('pgsms_group_scoped');
    const normal = await db.query<any>('SELECT current_user AS username', { type: QueryTypes.SELECT });
    expect(normal[0].username).not.toBe('pgsms_group_scoped');
  });

  it('enforces scope through HTTP, prevents direct edits and keeps read-only GET usable', async () => {
    await tx.commit();
    httpAccess = { ...flags(true, true), permissions: new Set(['masters.view', 'masters.manage', 'plan.view', 'admission.view']) };
    const configured = jest.spyOn(scope, 'configure');
    let observed: any;
    ClassGroup.addHook('beforeFind', 'observe_scope', () => { observed = scope.current(); });
    const list = await request(app.getHttpServer()).get('/masters/class-groups').expect(200);
    ClassGroup.removeHook('beforeFind', 'observe_scope');
    expect(configured).toHaveBeenCalledWith(staffId, httpAccess, false, undefined);
    expect(observed).toEqual(expect.objectContaining({ staffId, restrictView: true }));
    expect(list.body.map((group: any) => group.id)).toEqual([owned]);
    const options = await request(app.getHttpServer()).get('/masters/class-groups/options').expect(200);
    expect(options.body.map((group: any) => group.id)).toEqual([owned]);
    expect(options.body[0]).not.toHaveProperty('members');

    await request(app.getHttpServer()).get(`/masters/class-groups/${other}`).expect(404);
    await request(app.getHttpServer()).put(`/masters/class-groups/${other}`).send({ note: 'blocked' }).expect(403);
    httpAccess = { ...flags(false, false, true), permissions: httpAccess.permissions };
    await request(app.getHttpServer()).get(`/masters/class-groups/${owned}`).expect(200);
    await request(app.getHttpServer()).put(`/masters/class-groups/${owned}`).send({ note: 'blocked' }).expect(403);
    httpAccess = { ...flags(), permissions: httpAccess.permissions };
    const unrestricted = await request(app.getHttpServer()).get('/masters/class-groups').expect(200);
    expect(unrestricted.body.map((group: any) => group.id)).toEqual(expect.arrayContaining([owned, other, unassigned]));
    await request(app.getHttpServer()).put(`/groups/${other}/responsible-staff`).send({ responsibleStaffId: staffId }).expect(403);
    httpAccess.permissions.add('groups.assign');
    const assigned = await request(app.getHttpServer()).put(`/groups/${other}/responsible-staff`).send({ responsibleStaffId: staffId }).expect(200);
    expect(assigned.body.data.responsibleStaffId).toBe(staffId);
    httpAccess = { ...flags(false, false, true), permissions: httpAccess.permissions };
    await request(app.getHttpServer()).put(`/groups/${owned}/responsible-staff`).send({ responsibleStaffId: staffId }).expect(403);
    httpAccess = { ...flags(true, true), permissions: new Set(['scheduling.view', 'scheduling.organize']) };
    const schedulingOptions = await request(app.getHttpServer()).get('/scheduling/class-groups/options').expect(200);
    expect(schedulingOptions.body.map((group: any) => group.id)).toEqual(expect.arrayContaining([owned]));
    expect(schedulingOptions.body.map((group: any) => group.id)).toContain(unassigned);
    await request(app.getHttpServer()).get('/masters/class-groups/options').expect(403);
  });

  it('can create an offering for the assigned group under both scope locks', async () => {
    const [subject] = await query('SELECT id FROM subjects LIMIT 1');
    expect(subject).toBeDefined();
    await scope.run(staffId, flags(true, true), async () => {
      const offering = await CourseOffering.create({ subjectId: subject.id }, { transaction: tx });
      await query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at)
        VALUES (:id,:offering,:owned,now(),now()) RETURNING id`, { id: randomUUID(), offering: offering.id, owned });
      expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: offering.id })).toHaveLength(1);
    });
  });

  it('hides shared offerings and gradebook JSON when any linked group is outside scope', async () => {
    const [subject] = await query('SELECT id FROM subjects LIMIT 1');
    const offering = await CourseOffering.create({ subjectId: subject.id }, { transaction: tx });
    for (const groupId of [owned, other]) await query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at)
      VALUES (:id,:offering,:groupId,now(),now()) RETURNING id`, { id: randomUUID(), offering: offering.id, groupId });
    await query(`INSERT INTO course_exam_gradebooks(id,course_offering_id,class_group_id,grades,created_at,updated_at)
      VALUES (:id,:offering,:owned,'[]'::jsonb,now(),now()) RETURNING id`, { id: randomUUID(), offering: offering.id, owned });
    await scope.run(staffId, flags(true, true), async () => {
      expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: offering.id })).toHaveLength(0);
      expect(await query('SELECT id FROM course_exam_gradebooks WHERE course_offering_id=:id', { id: offering.id })).toHaveLength(0);
    });
  });

  it('shows a shared timetable only in scheduling reads and retains learner and write restrictions', async () => {
    const [subject] = await query('SELECT id FROM subjects LIMIT 1');
    const offering = await CourseOffering.create({ subjectId: subject.id }, { transaction: tx });
    const room = await Room.create({ code: `R${randomUUID().slice(0, 8)}`, name: 'Scope room', capacity: 50, isActive: true }, { transaction: tx });
    const lecturer = await Lecturer.create({ code: `L${randomUUID().slice(0, 8)}`, name: 'Scope lecturer', active: true }, { transaction: tx });
    const session = await TeachingSession.create({ courseOfferingId: offering.id, sessionDate: '2099-01-05', startTime: '07:00', endTime: '12:00', period: 'MORNING', lecturerId: lecturer.id, roomId: room.id }, { transaction: tx });
    for (const groupId of [owned, other]) await query(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at)
      VALUES (:id,:offering,:groupId,now(),now()) RETURNING id`, { id: randomUUID(), offering: offering.id, groupId });
    await query(`INSERT INTO course_exam_gradebooks(id,course_offering_id,class_group_id,grades,created_at,updated_at)
      VALUES (:id,:offering,:owned,'[]'::jsonb,now(),now()) RETURNING id`, { id: randomUUID(), offering: offering.id, owned });
    await scope.run(staffId, flags(true, true), async () => {
      expect(await query('SELECT id FROM course_offerings WHERE id=:id', { id: offering.id })).toHaveLength(1);
      expect(await query('SELECT id FROM teaching_sessions WHERE id=:id', { id: session.id })).toHaveLength(1);
      expect(await query('SELECT class_group_id FROM course_offering_class_groups WHERE course_offering_id=:id', { id: offering.id })).toEqual([{ class_group_id: owned }]);
      expect(await query('SELECT id FROM admission_records WHERE id=:id', { id: otherRecord })).toHaveLength(0);
      expect(await query('SELECT id FROM course_exam_gradebooks WHERE course_offering_id=:id', { id: offering.id })).toHaveLength(0);
      expect(await query('SELECT app_offering_allowed(:id,true) AS allowed', { id: offering.id })).toEqual([{ allowed: false }]);
      expect(await query("UPDATE course_offerings SET note='blocked' WHERE id=:id RETURNING id", { id: offering.id })).toHaveLength(0);
      expect(await query('DELETE FROM course_offerings WHERE id=:id RETURNING id', { id: offering.id })).toHaveLength(0);
      expect(await query("UPDATE teaching_sessions SET note='blocked' WHERE id=:id RETURNING id", { id: session.id })).toHaveLength(0);
      expect(await query('DELETE FROM teaching_sessions WHERE id=:id RETURNING id', { id: session.id })).toHaveLength(0);
    }, true);
    await tx.commit();
    try {
      httpAccess = { ...flags(true, true), permissions: new Set(['scheduling.view', 'scheduling.write', 'scheduling.organize']) };
      const detail = await request(app.getHttpServer()).get(`/scheduling/course-offerings/${offering.id}`).expect(200);
      expect(detail.body.canWriteSchedule).toBe(true);
      expect(detail.body).not.toHaveProperty('gradebookSnapshot');
      expect(detail.body).not.toHaveProperty('participantNotes');
      expect(detail.body.groupLinks.map((link: any) => link.classGroupId).sort()).toEqual([owned, other].sort());
      const roster = await request(app.getHttpServer()).get(`/scheduling/course-offerings/${offering.id}/roster`).expect(200);
      expect(roster.body.participants.map((person: any) => person.id)).toEqual(expect.arrayContaining([`admission:${ownedRecord}`, `admission:${otherRecord}`]));
      const calendar = await request(app.getHttpServer()).get('/scheduling/teaching-sessions?from=2099-01-05&to=2099-01-05').expect(200);
      expect(calendar.body.map((row: any) => row.id)).toContain(session.id);
      expect(calendar.body.find((row: any) => row.id === session.id).courseOffering.canWriteSchedule).toBe(true);
      httpAccess = { ...flags(true, true, true), permissions: httpAccess.permissions };
      await request(app.getHttpServer()).delete(`/scheduling/course-offerings/${offering.id}/teaching-sessions`).expect(403);
      await request(app.getHttpServer()).delete(`/scheduling/teaching-sessions/${session.id}`).expect(403);
      await request(app.getHttpServer()).put(`/scheduling/teaching-sessions/${session.id}/confirmation`).send({ status: 'held' }).expect(403);
      httpAccess = { ...flags(true, true, true), permissions: httpAccess.permissions };
      await request(app.getHttpServer()).get(`/scheduling/course-offerings/${offering.id}`).expect(200);
    } finally {
      await TeachingSession.destroy({ where: { id: session.id } });
      await db.query('DELETE FROM course_exam_gradebooks WHERE course_offering_id=:id', { replacements: { id: offering.id } });
      await db.query('DELETE FROM course_offering_class_groups WHERE course_offering_id=:id', { replacements: { id: offering.id } });
      await CourseOffering.destroy({ where: { id: offering.id } });
      await Room.destroy({ where: { id: room.id } });
      await Lecturer.destroy({ where: { id: lecturer.id } });
    }
  });

  it('keeps exemption lookups correct and scoped, including malformed participant identities', async () => {
    const [english] = await query("SELECT id FROM subjects WHERE lower(trim(name)) IN ('tiếng anh','english','ngoại ngữ') LIMIT 1");
    const [otherSubject] = await query("SELECT id FROM subjects WHERE lower(trim(name)) NOT IN ('tiếng anh','english','ngoại ngữ') AND upper(code)<>'HPTA' AND canonical_subject_id IS NULL LIMIT 1");
    expect(english).toBeDefined(); expect(otherSubject).toBeDefined();
    await query('UPDATE admission_records SET is_exempt_foreign_language=true WHERE id IN (:ids) RETURNING id', { ids: [ownedRecord, otherRecord] });
    await scope.run(staffId, flags(true), async () => {
      const sql = `SELECT person.id FROM jsonb_array_elements_text(CAST(:people AS jsonb)) person(id)
        WHERE ${profileForeignLanguageExemptSql('person.id', ':subjectId', ':year')}`;
      const values = { people: JSON.stringify([`admission:${ownedRecord}`, `admission:${otherRecord}`, 'admission:broken', 'student:broken', `admission:${randomUUID()}`, null]), subjectId: english.id, year: '2026' };
      expect(await query(sql, values)).toEqual([{ id: `admission:${ownedRecord}` }]);
      expect(await query(sql, { ...values, subjectId: otherSubject.id })).toEqual([]);
    });
  });
});
