import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { routeViewCode } from '../../src/auth/route-permissions.js';

const describeDb = process.env.RUN_GROUP_SCOPE_POSTGRES_TESTS === 'true' ? describe : describe.skip;

describeDb('Unassigned admissions remain separate from learner scope in PostgreSQL', () => {
  let db: Sequelize, tx: Transaction, ids: Record<string, string>;
  const q = (sql: string, replacements: any = {}) => db.query<any>(sql, { transaction: tx, replacements, type: QueryTypes.SELECT })
    .catch(error => { throw new Error(error.original?.message || error.message); });
  beforeAll(() => {
    if (!process.env.DATABASE_URL?.endsWith('/pgsms_group_scope_test')) throw new Error('Use the isolated test database.');
    db = new Sequelize(process.env.DATABASE_URL, { logging: false });
  });
  beforeEach(async () => {
    ids = Object.fromEntries(['staff', 'viewer', 'manager', 'none', 'owned', 'other', 'free', 'ownRecord', 'otherRecord', 'linkedRecord', 'student', 'round'].map(key => [key, randomUUID()]));
    tx = await db.transaction();
    await q(`INSERT INTO staff(id,name,email,role) VALUES(:id,'Admission scope',:email,'scope-test') RETURNING id`, { id: ids.staff, email: ids.staff + '@example.invalid' });
    for (const role of ['viewer', 'manager', 'none']) {
      await q(`INSERT INTO roles(id,code,name,restrict_group_view,restrict_group_edit,created_at,updated_at) VALUES(:id,:id,'Admission scope',true,true,now(),now()) RETURNING id`, { id: ids[role] });
      await q(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:staff,:role,now(),now()) RETURNING staff_id`, { staff: ids.staff, role: ids[role] });
      if (role !== 'none') await q(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
        SELECT :role,id,now(),now() FROM permissions WHERE code IN (:codes) RETURNING role_id`, {
        role: ids[role], codes: ['module.admission', 'admission.view', ...(role === 'manager' ? ['admission.manage'] : [])],
      });
    }
    for (const group of ['owned', 'other']) await q(`INSERT INTO class_groups(id,code,name,program,responsible_staff_id,created_at,updated_at)
      VALUES(:id,:id,'Admission scope','masters',:staff,now(),now()) RETURNING id`, { id: ids[group], staff: group === 'owned' ? ids.staff : null });
    await q(`INSERT INTO students(id,name_with_initials,full_name,postal_address,email,tel_no,password,account_type)
      VALUES(:id,'Scope','Scope','Test',:email,'0','unused','prospective') RETURNING id`, { id: ids.student, email: ids.student + '@example.invalid' });
    for (const record of ['free', 'ownRecord', 'otherRecord', 'linkedRecord']) await q(`INSERT INTO admission_records(id,full_name,training_level,academic_year,student_id,created_at,updated_at)
      VALUES(:id,'Admission scope','Thạc sĩ','2026',:student,now(),now()) RETURNING id`, { id: ids[record], student: record === 'linkedRecord' ? ids.student : null });
    for (const [group, record, student] of [['owned', 'ownRecord', null], ['other', 'otherRecord', ids.student]]) await q(`INSERT INTO class_group_members(id,class_group_id,admission_record_id,student_id,created_at,updated_at)
      VALUES(:id,:group,:record,:student,now(),now()) RETURNING id`, { id: randomUUID(), group: ids[group!], record: ids[record!], student });
    await q(`INSERT INTO admission_rounds(id,name,academic_year,regulation_no,rules,created_at,updated_at)
      VALUES(:id,'Scope','2026','Test','{}',now(),now()) RETURNING id`, { id: ids.round });
    for (const record of ['free', 'ownRecord', 'otherRecord']) {
      await q(`INSERT INTO admission_evaluations(id,admission_record_id,round_id,inputs,record_snapshot,created_at,updated_at)
        VALUES(:id,:record,:round,'{}','{}',now(),now()) RETURNING id`, { id: randomUUID(), record: ids[record], round: ids.round });
      await q(`INSERT INTO admission_evaluation_history(id,admission_record_id,action,actor,snapshot,created_at,updated_at)
        VALUES(:id,:record,'saved','Test','{}',now(),now()) RETURNING id`, { id: randomUUID(), record: ids[record] });
    }
  });
  afterEach(async () => {
    if (tx && !(tx as any).finished) await tx.rollback();
    else if (tx) {
      // Only the HTTP case commits fixtures so that the application's pool can see them.
      await db.query('DELETE FROM admission_evaluation_history WHERE admission_record_id IN (:records)', { replacements: { records: [ids.free, ids.ownRecord, ids.otherRecord] } });
      await db.query('DELETE FROM admission_evaluations WHERE round_id=:id', { replacements: { id: ids.round } });
      await db.query('DELETE FROM admission_rounds WHERE id=:id', { replacements: { id: ids.round } });
      await db.query('DELETE FROM class_group_members WHERE class_group_id IN (:groups)', { replacements: { groups: [ids.owned, ids.other] } });
      await db.query('DELETE FROM admission_records WHERE id IN (:records)', { replacements: { records: [ids.free, ids.ownRecord, ids.otherRecord, ids.linkedRecord] } });
      await db.query('DELETE FROM class_groups WHERE id IN (:groups)', { replacements: { groups: [ids.owned, ids.other] } });
      await db.query('DELETE FROM students WHERE id=:id', { replacements: { id: ids.student } });
      await db.query('DELETE FROM auth_audit_logs WHERE actor_staff_id=:id', { replacements: { id: ids.staff } });
      await db.query('DELETE FROM staff_roles WHERE staff_id=:id', { replacements: { id: ids.staff } });
      await db.query('DELETE FROM role_permissions WHERE role_id IN (:roles)', { replacements: { roles: [ids.viewer, ids.manager, ids.none] } });
      await db.query('DELETE FROM roles WHERE id IN (:roles)', { replacements: { roles: [ids.viewer, ids.manager, ids.none] } });
      await db.query('DELETE FROM staff WHERE id=:id', { replacements: { id: ids.staff } });
    }
  });
  afterAll(async () => { await db?.close(); });

  async function scoped(role = 'viewer', action = 'view', readOnly = false) {
    await db.query('SET LOCAL ROLE pgsms_group_scoped', { transaction: tx });
    await q(`SELECT set_config('app.group_staff_id',:staff,true),set_config('app.active_profile_id',:role,true),
      set_config('app.profile_enforced','true',true),set_config('app.group_view_restricted','true',true),
      set_config('app.group_edit_restricted','true',true),set_config('app.group_read_only',:readonly,true),
      set_config('app.admission_action',:action,true),set_config('app.academic_domain','',true),set_config('app.scheduling_action','',true)`,
    { staff: ids.staff, role: ids[role], action, readonly: String(readOnly) });
  }

  it('exposes unassigned and owned admissions, scores and history while hiding other classes and student aliases', async () => {
    await scoped();
    const visible = await q('SELECT id FROM admission_records WHERE id IN (:ids)', { ids: [ids.free, ids.ownRecord, ids.otherRecord, ids.linkedRecord] });
    expect(visible.map(row => row.id).sort()).toEqual([ids.free, ids.ownRecord].sort());
    for (const table of ['admission_evaluations', 'admission_evaluation_history']) {
      const rows = await q(`SELECT admission_record_id FROM ${table} WHERE admission_record_id IN (:ids)`, { ids: [ids.free, ids.ownRecord, ids.otherRecord] });
      expect(rows.map(row => row.admission_record_id).sort()).toEqual([ids.free, ids.ownRecord].sort());
    }
    expect(await q('SELECT id FROM class_groups WHERE id=:id', { id: ids.other })).toHaveLength(0);
    expect(await q('SELECT id FROM students WHERE id=:id', { id: ids.student })).toHaveLength(0);
    expect((await q('SELECT app_record_allowed(:id,false) allowed', { id: ids.free }))[0].allowed).toBe(false);
  });

  it('does not reuse admission access in learner requests or borrow permissions from another profile', async () => {
    await scoped('viewer', '');
    expect(await q('SELECT id FROM admission_records WHERE id=:id', { id: ids.free })).toHaveLength(0);
    await scoped('none', 'view');
    expect(await q('SELECT id FROM admission_records WHERE id=:id', { id: ids.free })).toHaveLength(0);
  });

  it('requires manage permission and a manage request for changes to unassigned admissions', async () => {
    await scoped('viewer', 'manage');
    expect(await q('UPDATE admission_records SET note=\'denied\' WHERE id=:id RETURNING id', { id: ids.free })).toHaveLength(0);
    await scoped('manager', 'view');
    expect(await q('UPDATE admission_records SET note=\'denied\' WHERE id=:id RETURNING id', { id: ids.free })).toHaveLength(0);
    await scoped('manager', 'manage');
    expect(await q('UPDATE admission_records SET note=\'allowed\' WHERE id=:id RETURNING id', { id: ids.free })).toHaveLength(1);
    expect(await q('UPDATE admission_evaluations SET version=version+1 WHERE admission_record_id=:id RETURNING id', { id: ids.free })).toHaveLength(1);
    expect(await q('UPDATE admission_records SET note=\'denied\' WHERE id=:id RETURNING id', { id: ids.otherRecord })).toHaveLength(0);
  });

  it('keeps readonly effective and permits creation before class assignment for managers', async () => {
    await scoped('manager', 'manage', true);
    expect(await q('UPDATE admission_records SET note=\'denied\' WHERE id=:id RETURNING id', { id: ids.free })).toHaveLength(0);
    await scoped('manager', 'manage');
    const id = randomUUID();
    expect(await q(`INSERT INTO admission_records(id,full_name,training_level,created_at,updated_at)
      VALUES(:id,'New application','Thạc sĩ',now(),now()) RETURNING id`, { id })).toEqual([{ id }]);
  });

  it('stops pre-class access as soon as the record is assigned to another class', async () => {
    await q(`INSERT INTO class_group_members(id,class_group_id,admission_record_id,created_at,updated_at)
      VALUES(:id,:group,:record,now(),now()) RETURNING id`, { id: randomUUID(), group: ids.other, record: ids.free });
    await scoped();
    expect(await q('SELECT id FROM admission_records WHERE id=:id', { id: ids.free })).toHaveLength(0);
    expect(await q('SELECT id FROM admission_evaluations WHERE admission_record_id=:id', { id: ids.free })).toHaveLength(0);
  });

  it('applies the pre-class scope through authenticated ranking and detail APIs without granting score edits', async () => {
    await q(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at)
      SELECT :role,id,now(),now() FROM permissions WHERE code=:code RETURNING role_id`, {
      role: ids.viewer, code: routeViewCode('/masters/admission-scores'),
    });
    await tx.commit();
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      app.use((req: any, _res: any, next: any) => {
        req.user = Staff.build({ id: ids.staff, name: 'Admission scope', email: ids.staff + '@example.invalid', role: 'scope-test', status: 'active', mustChangePassword: false });
        req.isAuthenticated = () => true; next();
      });
      await app.init();
      const agent = request.agent(app.getHttpServer());
      const origin = String(app.get(ConfigService).get('FRONTEND_URL')).replace(/\/$/, '');
      await agent.post('/auth/profiles/select').set('Origin', origin).send({ profileId: ids.viewer }).expect(200);
      const response = await agent.get(`/plan/admission-rounds/${ids.round}/ranking`).expect(200);
      expect(response.body.rows.map((row: any) => row.admissionRecordId).sort()).toEqual([ids.free, ids.ownRecord].sort());
      await agent.get(`/plan/admission-records/${ids.free}`).expect(200);
      await agent.get(`/plan/admission-records/${ids.otherRecord}`).expect(404);
      await agent.get(`/plan/admission-records/${ids.free}/evaluation`).expect(200);
      await agent.put(`/plan/admission-rounds/${ids.round}/scores`).send({ rows: [] }).expect(403);
    } finally { await app.close(); }
  }, 30000);
});
