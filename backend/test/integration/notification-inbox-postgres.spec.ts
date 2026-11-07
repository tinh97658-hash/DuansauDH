import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { databaseModels } from '../../src/database/database.module.js';
import { Staff } from '../../src/database/models/staff.model.js';
import { Role } from '../../src/database/models/role.model.js';
import { StaffRole } from '../../src/database/models/staff-role.model.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { GroupScopeService } from '../../src/auth/group-scope.service.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';
import { InboxAccessService } from '../../src/notifications/inbox-access.service.js';
import { InboxSyncService } from '../../src/notifications/inbox-sync.service.js';
import { InboxService } from '../../src/notifications/inbox.service.js';
import { ExamWorkflowService } from '../../src/masters/exam-workflow.service.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { InboxController } from '../../src/notifications/inbox.controller.js';
import { WorkingProfileGuard } from '../../src/auth/working-profile.js';
import { GroupScopeInterceptor } from '../../src/auth/group-scope.interceptor.js';
import { groupScopeStorage } from '../../src/auth/group-scope-context.js';
import { createNotificationDatabase } from '../helpers/notification-database.js';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const describeDb = process.env.RUN_NOTIFICATION_POSTGRES_TESTS === 'true' ? describe : describe.skip;
describeDb('Notification V2 — isolated PostgreSQL, actual audit capture and business RLS', () => {
  let raw: Sequelize, db: Sequelize, rbac: RbacService, scope: GroupScopeService, access: InboxAccessService, sync: InboxSyncService, inbox: InboxService;
  let app: any;
  let isolated: Awaited<ReturnType<typeof createNotificationDatabase>> | undefined;
  let metrics: { fixtureMs: number; testMs: number; workerMs: number[]; state?: any; queries: Record<string, { count: number; ms: number; maxMs: number }> };
  let testStart: number;
  const principal = { user: 'b', profile: 'approve', authenticated: true };
  const ids = Object.fromEntries(['a','b','c','d','submit','approve','outside','groupA','groupB','groupD','major','major2','discipline','subject','offering','record','leave','transfer'].map(k => [k, randomUUID()]));
  const actors: Record<string, Staff> = {};
  const q = (sql: string, replacements: any = {}) => raw.query<any>(sql, { replacements, type: QueryTypes.SELECT })
    .catch(error => { throw new Error(error.original?.message || error.message); });
  const as = <T>(user: string, profile: string, fn: () => Promise<T>) => workingProfileStorage.run({ staffId: ids[user], roleId: ids[profile], selectionRequired: false, requestMethod: 'GET' }, fn);
  const list = (user = 'b', profile = 'approve') => as(user, profile, () => inbox.list(actors[user]));
  const sourceWrite = async (user: string, profile: string, work: (transaction: any) => Promise<any>) => raw.transaction(async transaction => {
    await raw.query(`SELECT set_config('app.actor_staff_id',:staff,true),set_config('app.actor_profile_id',:profile,true)`, { transaction, replacements: { staff: ids[user], profile: ids[profile] } });
    return work(transaction);
  });
  const grade = (action: string, user = 'a', profile = 'submit') => sourceWrite(user, profile, transaction => new ExamWorkflowService(raw, rbac).event(ids.offering, `final.${action}`, actors[user], '', {}, {}, transaction));
  const appendLeave = async (action: string, user: string, profile: string) => sourceWrite(user, profile, transaction => raw.query(`UPDATE study_leaves SET history=history||CAST(:event AS jsonb) WHERE id=:id`, {
    transaction, replacements: { id: ids.leave, event: JSON.stringify([{ action, at: new Date().toISOString(), actorId: ids[user] }]) },
  }));
  const submittedGrades = async () => {
    await grade('submit'); await sync.sync();
    await grade('submit','b','approve'); await sync.sync();
  };
  const requestTransfer = () => sourceWrite('a','submit', transaction => raw.query(`INSERT INTO major_transfers(id,admission_record_id,from_major_id,to_major_id,status,requested_at,created_at,updated_at)
    VALUES(:id,:record,:from,:to,'pending',now(),now(),now())`, { transaction, replacements: { id: ids.transfer, record: ids.record, from: ids.major, to: ids.major2 } }));
  const rejectTransfer = () => sourceWrite('b','approve', transaction => raw.query("UPDATE major_transfers SET status='rejected',decided_at=clock_timestamp() WHERE id=:id", { transaction, replacements: { id: ids.transfer } }));
  beforeEach(async () => {
    const fixtureStart = performance.now();
    testStart = fixtureStart;
    app = undefined; raw = undefined!; db = undefined!; sync = undefined!; access = undefined!;
    metrics = { fixtureMs: 0, testMs: 0, workerMs: [], queries: {} };
    Object.assign(principal, { user: 'b', profile: 'approve', authenticated: true });
    isolated = await createNotificationDatabase(process.env.NOTIFICATION_TEST_DATABASE_URL);
    const timing = (name: string) => (_sql: string, ms?: number) => {
      const value = metrics.queries[name] ||= { count: 0, ms: 0, maxMs: 0 };
      value.count++; value.ms += ms || 0; value.maxMs = Math.max(value.maxMs, ms || 0);
    };
    raw = new Sequelize(isolated.url, { logging: timing('raw'), benchmark: true });
    db = new Sequelize(isolated.url, { logging: timing('access'), benchmark: true, models: databaseModels });
    expect((await q(`SELECT (SELECT count(*) FROM staff)::int AS staff,
      (SELECT count(*) FROM notification_events)::int AS events,
      (SELECT count(*) FROM notification_deliveries)::int AS deliveries,
      (SELECT count(*) FROM notification_ingested_changes)::int AS receipts`))[0])
      .toEqual({ staff: 0, events: 0, deliveries: 0, receipts: 0 });
    rbac = new RbacService(Role, StaffRole); scope = new GroupScopeService(db); scope.onModuleInit();
    access = new InboxAccessService(db, rbac, scope);
    const config = new ConfigService({ NOTIFICATION_V2_ENABLED: 'true' });
    sync = new InboxSyncService(raw, access, rbac, config); inbox = new InboxService(db, access, config);
    const runSync = sync.sync.bind(sync);
    sync.sync = async () => { const start = performance.now(); try { await runSync(); } finally { metrics.workerMs.push(performance.now()-start); } };
    for (const key of ['submit','approve','outside']) {
      await q(`INSERT INTO roles(id,code,name,active,restrict_group_view,created_at,updated_at) VALUES(:id,:code,:code,true,:restricted,now(),now()) RETURNING id`, { id: ids[key], code: `notification_${ids[key]}`, restricted: key !== 'approve' });
      await q(`INSERT INTO role_permissions(role_id,permission_id,created_at,updated_at) SELECT :role,id,now(),now() FROM permissions
        WHERE (:approve OR (code NOT IN ('gradebook.approve','studyleave.approve','majortransfer.approve') AND code NOT LIKE '%-approve')) RETURNING role_id`, { role: ids[key], approve: key !== 'submit' });
    }
    for (const key of ['a','b','c','d']) {
      await q(`INSERT INTO staff(id,name,email,role,status) VALUES(:id,:name,:email,'custom','active') RETURNING id`, { id: ids[key], name: `Notification ${key}`, email: `${ids[key]}@example.invalid` });
      actors[key] = Staff.build({ id: ids[key], name: `Notification ${key}`, role: 'custom', status: 'active' });
      await q(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:staff,:role,now(),now()) RETURNING staff_id`, { staff: ids[key], role: ids[key === 'a' ? 'submit' : key === 'c' ? 'outside' : 'approve'] });
    }
    await q(`INSERT INTO staff_roles(staff_id,role_id,created_at,updated_at) VALUES(:staff,:role,now(),now()) RETURNING staff_id`, { staff: ids.b, role: ids.submit });
    for (const [group,owner] of [['groupA','a'],['groupB','b'],['groupD','d']]) await q(`INSERT INTO class_groups(id,code,name,program,academic_year,responsible_staff_id,created_at,updated_at) VALUES(:id,:id,'Notification test','masters','2026',:owner,now(),now()) RETURNING id`, { id: ids[group], owner: ids[owner] });
    await q(`INSERT INTO disciplines(id,code,name,created_at,updated_at) VALUES(:id,:code,'Notification discipline',now(),now()) RETURNING id`, { id: ids.discipline, code: ids.discipline.slice(0,8) });
    for (const key of ['major','major2']) await q(`INSERT INTO majors(id,discipline_id,code,name,program,created_at,updated_at) VALUES(:id,:discipline,:code,'Notification major','masters',now(),now()) RETURNING id`, { id: ids[key], code: ids[key].slice(0,8), discipline: ids.discipline });
    await q(`INSERT INTO subjects(id,major_id,code,name,program,created_at,updated_at) VALUES(:id,:major,:code,'Notification subject','masters',now(),now()) RETURNING id`, { id: ids.subject, code: ids.subject.slice(0,8), major: ids.major });
    await q(`INSERT INTO course_offerings(id,subject_id,name,created_at,updated_at) VALUES(:id,:subject,'Notification offering',now(),now()) RETURNING id`, { id: ids.offering, subject: ids.subject });
    for (const group of ['groupA','groupB','groupD']) await q(`INSERT INTO course_offering_class_groups(id,course_offering_id,class_group_id,created_at,updated_at) VALUES(:id,:offering,:group,now(),now()) RETURNING id`, { id: randomUUID(), offering: ids.offering, group: ids[group] });
    await q(`INSERT INTO admission_records(id,full_name,code,training_level,academic_year,major_id,created_at,updated_at) VALUES(:id,'Notification learner',:id,'Thạc sĩ','2026',:major,now(),now()) RETURNING id`, { id: ids.record, major: ids.major });
    await q(`INSERT INTO class_group_members(id,class_group_id,admission_record_id,enrolled_at,created_at,updated_at) VALUES(:id,:group,:record,now(),now(),now()) RETURNING id`, { id: randomUUID(), group: ids.groupA, record: ids.record });
    // Ignore earlier fixture/seed history. Activation is isolated to this test DB.
    await grade('submit');
    await raw.query(`UPDATE notification_activation SET activated_at=clock_timestamp(),
      activated_after_change_id=COALESCE(pg_sequence_last_value(pg_get_serial_sequence('db_change_logs','id')::regclass),0)`);
    const module = await Test.createTestingModule({ controllers: [InboxController], providers: [{ provide: InboxService, useValue: inbox }] }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: any) => {
      req.user = actors[principal.user]; req.isAuthenticated = () => principal.authenticated;
      workingProfileStorage.run({ staffId: req.user.id, roleId: ids[principal.profile], selectionRequired: false, requestMethod: req.method }, () =>
        groupScopeStorage.run({ staffId: '', restrictView: false, restrictEdit: false, readOnly: false }, next));
    });
    app.useGlobalGuards(new WorkingProfileGuard());
    app.useGlobalInterceptors(new GroupScopeInterceptor(rbac, scope));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    metrics.fixtureMs = performance.now() - fixtureStart;
    testStart = performance.now();
  }, 60000);
  afterEach(async () => {
    metrics.testMs = performance.now() - testStart;
    const errors: unknown[] = [];
    const cleanup = async (work: () => unknown) => { try { await work(); } catch (error) { errors.push(error); } };
    // Drain the worker first; always attempt every resource cleanup on failure.
    await cleanup(() => sync?.onModuleDestroy());
    await cleanup(async () => {
      if (process.env.NOTIFICATION_TEST_TRACE_DIR && raw) metrics.state = {
        ids,
        activation: await q('SELECT * FROM notification_activation'),
        source: await q("SELECT id,actor_staff_id,actor_profile_id,changed_at,new_data->>'action' AS action FROM db_change_logs WHERE table_name='gradebook_events' ORDER BY id"),
        events: await q('SELECT id,kind,source_key,change_id FROM notification_events'),
        deliveries: await q('SELECT * FROM notification_deliveries'),
        receipts: await q('SELECT * FROM notification_ingested_changes'),
        targetD: await access?.target(actors.d,ids.approve,{kind:'grade.submitted',entityId:ids.offering},'approver'),
      };
    });
    await cleanup(() => app?.close());
    await cleanup(() => db?.close());
    await cleanup(() => raw?.close());
    await cleanup(() => {
      if (process.env.NOTIFICATION_TEST_TRACE_DIR && isolated) {
        mkdirSync(process.env.NOTIFICATION_TEST_TRACE_DIR, { recursive: true });
        writeFileSync(join(process.env.NOTIFICATION_TEST_TRACE_DIR, `${isolated.name}.json`), JSON.stringify({
          test: expect.getState().currentTestName, database: isolated.name, ...metrics,
        }, null, 2));
      }
    });
    await cleanup(() => isolated?.close()); isolated = undefined;
    if (errors.length) throw new AggregateError(errors, 'Notification fixture cleanup failed');
  });

  it('delivers submitted grades to other permitted profiles, never the actor', async () => {
    await grade('submit'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
    const b = await list(); expect(b.items).toHaveLength(1); expect(b.unreadCount).toBe(1); expect(b.items[0].href).toContain(`offeringId=${ids.offering}`);
    expect((await list('a','submit')).total).toBe(0);
    expect((await list('b','submit')).total).toBe(0);
    expect((await list('c','outside')).total).toBe(0);
    await grade('submit','b','approve'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
    expect((await list()).unreadCount).toBe(1);
    expect((await list('d','approve')).unreadCount).toBe(2);
    await q(`INSERT INTO notification_deliveries(id,event_id,staff_id,profile_id,audience)
      SELECT gen_random_uuid(),id,:staff,:profile,'approver' FROM notification_events WHERE actor_staff_id=:staff RETURNING id`,
    { staff: ids.b, profile: ids.approve });
    expect((await list()).unreadCount).toBe(1); // Existing self-deliveries are hidden too.
  });
  it('keeps post-activation facts when the audit clock moves behind the activation timestamp', async () => {
    // Notification metadata alone simulates a clock correction; source audit is untouched.
    await raw.query("UPDATE notification_activation SET activated_at=clock_timestamp()+interval '1 day'");
    await grade('submit'); await sync.sync();
    expect((await list()).total).toBe(1);
    expect((await list('d','approve')).total).toBe(1);
  });
  it('excludes pre-activation audit IDs allocated by a transaction that commits after activation', async () => {
    const transaction = await raw.transaction();
    try {
      await raw.query(`SELECT set_config('app.actor_staff_id',:staff,true),set_config('app.actor_profile_id',:profile,true)`, {
        transaction, replacements: { staff: ids.a, profile: ids.submit },
      });
      await new ExamWorkflowService(raw,rbac).event(ids.offering,'final.submit',actors.a,'',{},{},transaction);
      await raw.query(`UPDATE notification_activation SET activated_after_change_id=
        COALESCE(pg_sequence_last_value(pg_get_serial_sequence('db_change_logs','id')::regclass),0)`);
      const [boundary] = await q('SELECT activated_after_change_id AS id FROM notification_activation');
      const [visible] = await q('SELECT max(id) AS id FROM db_change_logs');
      expect(BigInt(boundary.id)).toBeGreaterThan(BigInt(visible.id));
      await transaction.commit();
      await grade('submit'); await sync.sync();
      expect((await list()).total).toBe(1);
      expect((await q('SELECT count(*)::int AS n FROM notification_events'))[0].n).toBe(1);
    } finally { if (!(transaction as any).finished) await transaction.rollback(); }
  });
  it('captures leave and extension requests/decisions from real append audit events', async () => {
    await sourceWrite('a','submit', transaction => raw.query(`INSERT INTO study_leaves(id,admission_record_id,reason,start_date,end_date,history)
      VALUES(:id,:record,'Test','2026-11-01','2026-12-01',CAST(:history AS jsonb))`, { transaction, replacements: { id: ids.leave, record: ids.record, history: JSON.stringify([{ action: 'requested', at: new Date().toISOString(), actorId: ids.a }]) } }));
    await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); }); expect((await list()).items.some(x => x.type === 'leave.requested')).toBe(true);
    await appendLeave('approve','b','approve'); await appendLeave('request_extension','a','submit'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
    expect((await list()).items.some(x => x.type === 'extension.requested')).toBe(true);
    await appendLeave('approve_extension','b','approve'); await appendLeave('request_extension','a','submit'); await appendLeave('reject_extension','b','approve'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
    const a = await as('a','submit', () => inbox.list(actors.a, 1, 50));
    expect(a.items.map(x => x.type)).toEqual(expect.arrayContaining(['leave.approved','extension.approved','extension.rejected']));
    expect(a.items.find(x => x.type === 'extension.approved').href).toBe('/masters/study-leaves');
  });
  it('does not lose a source transaction committed after a later audit ID was processed', async () => {
    const transaction = await raw.transaction();
    try {
      await raw.query(`SELECT set_config('app.actor_staff_id',:staff,true),set_config('app.actor_profile_id',:profile,true)`, { transaction, replacements: { staff: ids.a, profile: ids.submit } });
      await new ExamWorkflowService(raw, rbac).event(ids.offering, 'final.submit', actors.a, '', {}, {}, transaction);
      await grade('submit'); await sync.sync();
      const before = await list();
      await transaction.commit(); await sync.sync();
      expect((await list()).total).toBe(before.total + 1);
    } finally { if (!(transaction as any).finished) await transaction.rollback(); }
  });
  it('correlates transfer sender from audit and delivers the decision', async () => {
    await requestTransfer(); await sync.sync();
    expect((await list()).items.some(x => x.type === 'transfer.requested')).toBe(true);
    await rejectTransfer(); await sync.sync();
    const a = await as('a','submit', () => inbox.list(actors.a,1,50));
    expect(a.items.some(x => x.type === 'transfer.rejected' && x.href.includes(ids.record))).toBe(true);
  });
  describe('with two submitted grade requests', () => {
    beforeEach(async () => {
      const start = performance.now();
      await submittedGrades();
      expect((await list()).total).toBe(1);
      expect((await list('d','approve')).total).toBe(2);
      metrics.fixtureMs += performance.now() - start;
      testStart = performance.now();
    });

    it('persists read state independently, opening/listing is read-only, and rejects another profile/id', async () => {
      const before = await list(), id = before.items[0].id;
      const otherBefore = await list('d','approve');
      expect((await list()).unreadCount).toBe(before.unreadCount);
      await expect(as('b','submit', () => inbox.read(actors.b, id))).rejects.toThrow('Không tìm thấy');
      await expect(as('c','outside', () => inbox.read(actors.c, id))).rejects.toThrow('Không tìm thấy');
      await as('b','approve', () => inbox.read(actors.b, id));
      const restarted = new InboxService(db, access, new ConfigService({ NOTIFICATION_V2_ENABLED: true }));
      expect((await as('b','approve', () => restarted.list(actors.b))).unreadCount).toBe(before.unreadCount - 1);
      const [source] = await q('SELECT count(*)::int AS count FROM gradebook_events WHERE course_offering_id=:id', { id: ids.offering });
      expect(source.count).toBe(3); // Includes the pre-activation event, which was not delivered.
      expect((await list('d','approve')).unreadCount).toBe(otherBefore.unreadCount);
    });
    it('replays persisted facts without duplicate events or deliveries', async () => {
      const [count] = await q('SELECT count(*)::int AS n FROM notification_deliveries');
      await raw.query('DELETE FROM notification_ingested_changes'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
      expect((await q('SELECT count(*)::int AS n FROM notification_deliveries'))[0].n).toBe(count.n);
      expect((await q('SELECT count(*)::int AS n FROM notification_events'))[0].n).toBe(2);
    });
    it('sends approval and reopen to the original sender profile', async () => {
      await grade('approve','b','approve'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
      expect((await list()).items.some(x => x.type === 'grade.approved')).toBe(false); // B approved their own submission.
      await grade('submit'); await grade('approve','b','approve'); await grade('reopen','b','approve'); await sync.sync().catch(error => { throw new Error(error.original?.message || error.message); });
      const a = await list('a','submit');
      expect(a.items.map(x => x.type)).toEqual(expect.arrayContaining(['grade.approved','grade.reopened']));
      expect((await list('b','submit')).total).toBe(0);
    });
    describe('with a decided transfer and four approval requests', () => {
      beforeEach(async () => {
        const start = performance.now();
        await requestTransfer(); await sync.sync();
        await rejectTransfer(); await sync.sync();
        await grade('submit'); await sync.sync();
        metrics.fixtureMs += performance.now() - start;
        testStart = performance.now();
      });
      it('paginates and marks all read only for the current recipient', async () => {
        const page = await as('b','approve', () => inbox.list(actors.b, 2, 2)); expect(page.items).toHaveLength(1);
        const bBefore = (await list()).unreadCount;
        expect((await list('a','submit')).unreadCount).toBeGreaterThan(0);
        await as('a','submit', () => inbox.readAll(actors.a)); expect((await list('a','submit')).unreadCount).toBe(0);
        expect((await list()).unreadCount).toBeGreaterThan(0);
        expect((await list()).unreadCount).toBe(bBefore);
      });
    });
    it('enforces HTTP auth, pagination validation, active-profile mismatch and server-owned identity', async () => {
      const server = app.getHttpServer();
      const own = await request(server).get(`/notifications?userId=${ids.a}`).expect(200);
      expect(own.body.unreadCount).toBe((await list()).unreadCount);
      await request(server).get('/notifications?page=0').expect(400);
      await request(server).get('/notifications').set('X-Working-Profile-Id', ids.submit).expect(403);
      const other = await list('d','approve');
      await request(server).post(`/notifications/${other.items[0].id}/read`).expect(404);
      const selected = own.body.items[0];
      await request(server).post(`/notifications/${selected.id}/read`).send({ userId: ids.a }).expect(201);
      expect((await request(server).get('/notifications/unread-count').expect(200)).body.unreadCount).toBe(own.body.unreadCount - (selected.readAt ? 0 : 1));
      principal.authenticated = false;
      try { await request(server).get('/notifications').expect(401); } finally { principal.authenticated = true; }
    });
    it('enforces notification table RLS even without application WHERE filters', async () => {
      await as('b','approve', async () => {
        const effective = await rbac.effectiveAccess(actors.b, true);
        const rows = await scope.run(ids.b, effective, () => db.query<any>('SELECT id,staff_id,profile_id FROM notification_deliveries', { type: QueryTypes.SELECT }));
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.staff_id === ids.b && row.profile_id === ids.approve)).toBe(true);
      });
    });
    it('hides existing notifications and unread counts after permission or responsibility revocation', async () => {
      const before = await list(); expect(before.total).toBeGreaterThan(0);
      await q(`DELETE FROM role_permissions WHERE role_id=:id AND permission_id=(SELECT id FROM permissions WHERE code='gradebook.approve') RETURNING role_id`, { id: ids.approve });
      const hidden = await list(); expect(hidden.items.some(x => x.type === 'grade.submitted')).toBe(false);
      await q('UPDATE class_groups SET responsible_staff_id=NULL WHERE id IN (:ids) RETURNING id', { ids: [ids.groupA,ids.groupB] });
      // Gradebook notifications must not leak class names after responsibility loss.
      const after = await as('b','approve', () => inbox.list(actors.b,1,50));
      expect(after.items.filter(x => x.type.startsWith('grade.'))).toEqual([]);
      await expect(as('b','approve', () => inbox.read(actors.b, before.items.find(x => x.type.startsWith('grade.'))?.id || before.items[0].id))).rejects.toThrow('Không tìm thấy');
    });
  });
});
