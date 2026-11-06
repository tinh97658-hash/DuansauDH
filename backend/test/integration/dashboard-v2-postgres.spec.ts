import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { DashboardService } from '../../src/dashboard/dashboard.service.js';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { AppModule } from '../../src/app.module.js';
import { RbacService } from '../../src/auth/rbac.service.js';
import { GroupScopeService } from '../../src/auth/group-scope.service.js';
import { workingProfileStorage } from '../../src/auth/profile-context.js';

const describeDb = process.env.RUN_DASHBOARD_DB_TESTS === 'true' ? describe : describe.skip;
describeDb('Dashboard V2 read models on disposable PostgreSQL', () => {
  let db: Sequelize, transaction: Transaction, service: any;
  const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  beforeAll(async () => {
    if (!/\/pgsms_dashboard_test_\d+$/.test(process.env.DATABASE_URL || '')) throw Error('Disposable dashboard database required.');
    db = new Sequelize(process.env.DATABASE_URL!, { logging: false });
    transaction = await db.transaction();
    const query = db.query.bind(db);
    (db as any).query = (sql: string, options: any = {}) => query(sql, { ...options, transaction });
    // Shadow only inside this connection. No application or real learner data is changed.
    await db.query(`CREATE TEMP TABLE subjects(id uuid PRIMARY KEY,program text);
      CREATE TEMP TABLE class_groups(id uuid PRIMARY KEY,program text,academic_year text);
      CREATE TEMP TABLE course_offerings(id uuid PRIMARY KEY,subject_id uuid,name text,status text,completed_at timestamptz);
      CREATE TEMP TABLE course_offering_class_groups(course_offering_id uuid,class_group_id uuid);
      CREATE TEMP TABLE teaching_sessions(id uuid PRIMARY KEY,course_offering_id uuid,session_date date,start_time time,end_time time,status text);
      CREATE TEMP TABLE admission_records(id uuid PRIMARY KEY,training_level text,academic_year text,status text,study_status text,extra_data jsonb,student_id uuid);
      CREATE TEMP TABLE gradebook_events(id uuid PRIMARY KEY,course_offering_id uuid,action text,created_at timestamptz);
      INSERT INTO subjects VALUES('${id(1)}','masters'),('${id(2)}','doctoral');
      INSERT INTO class_groups VALUES('${id(3)}','masters','2026'),('${id(4)}','masters','2026'),('${id(5)}','masters','2025');
      INSERT INTO course_offerings VALUES
        ('${id(10)}','${id(1)}','Lớp ghép','completed',now()),
        ('${id(11)}','${id(1)}','Lớp năm khác','completed',now()),
        ('${id(12)}','${id(2)}','Lớp Tiến sĩ','completed',now());
      INSERT INTO course_offering_class_groups VALUES
        ('${id(10)}','${id(3)}'),('${id(10)}','${id(4)}'),('${id(11)}','${id(5)}'),('${id(12)}','${id(3)}');
      INSERT INTO teaching_sessions VALUES
        ('${id(20)}','${id(10)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','00:01','planned'),
        ('${id(21)}','${id(10)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','23:59:59','planned'),
        ('${id(22)}','${id(10)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','01:00','held'),
        ('${id(23)}','${id(10)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','01:00','not_held'),
        ('${id(24)}','${id(10)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','01:00','cancelled'),
        ('${id(25)}','${id(11)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','01:00','held'),
        ('${id(26)}','${id(12)}',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'00:00','01:00','held');
      INSERT INTO admission_records VALUES
        ('${id(30)}','Thạc sĩ','2026','accepted','Đang học','{}',NULL),
        ('${id(31)}','Thạc sĩ','2026','accepted','Đang học','{"tuitionPayment":{"paid":true}}',NULL),
        ('${id(32)}','Thạc sĩ','2026','accepted','Bảo lưu','{}',NULL),
        ('${id(33)}','Thạc sĩ','2025','accepted','Đang học','{}',NULL),
        ('${id(34)}','Tiến sĩ','2026','accepted','Đang học','{}',NULL);
      INSERT INTO gradebook_events VALUES('${id(40)}','${id(10)}','result.submit',now()),
        ('${id(41)}','${id(11)}','result.approve',now()),('${id(42)}','${id(12)}','result.approve',now());`);
    service = new DashboardService({} as any, {} as any, {} as any, {} as any, {} as any, db);
  });
  afterAll(async () => { await transaction?.rollback(); await db?.close(); });
  it('counts each scheduled session once despite merged classes and separates statuses without other cohorts/programs', async () => {
    const data = await service.sessionsChart('2026');
    expect(data.values.reduce((sum: number, value: any) => sum + value.count, 0)).toBe(4);
    expect(data.values).toEqual(expect.arrayContaining([
      { label: 'Đã diễn ra', count: 1 }, { label: 'Không diễn ra', count: 1 },
    ]));
    expect(data.values.filter((value: any) => !['Đã diễn ra', 'Không diễn ra'].includes(value.label))
      .reduce((sum: number, value: any) => sum + value.count, 0)).toBe(2);
  });
  it('counts a completed offering once and includes six months with explicit zero buckets', async () => {
    const data = await service.completionChart('2026');
    expect(data.values).toHaveLength(6);
    expect(data.values.reduce((sum: number, value: any) => sum + value.count, 0)).toBe(1);
  });
  it('uses the existing tuition-based study status, not the admissions status, and never counts other cohorts/programs', async () => {
    const data = await service.learnersChart('2026');
    expect(data.values).toEqual(expect.arrayContaining([
      { label: 'Đã trúng tuyển', count: 1 }, { label: 'Đang học', count: 1 }, { label: 'Bảo lưu', count: 1 },
    ]));
    expect(data.values.reduce((sum: number, value: any) => sum + value.count, 0)).toBe(3);
  });
  it('links recorded grade events to one concrete offering and a matching cohort group', async () => {
    const events = await service.gradeActivity('2026');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'Lớp ghép', detail: 'Bảng điểm đã gửi duyệt' });
    expect(events[0].href).toContain(`offeringId=${id(10)}`);
    expect(events[0].href).toContain(`groupId=${id(3)}`);
  });
});

describeDb('Dashboard V2 with actual profile grants and database read policies', () => {
  let app: any, actor: any, profile: any;
  beforeAll(async () => {
    if (!/\/pgsms_dashboard_test_\d+$/.test(process.env.DATABASE_URL || '')) throw Error('Disposable dashboard database required.');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    const db = app.get(getConnectionToken());
    actor = await db.models.Staff.findOne({ where: { email: 'dashboard-test@example.invalid' } });
    profile = await db.models.Role.findOne({ where: { code: 'admin' } });
    if (!actor || !profile) throw Error('Disposable fixture administrator missing.');
  }, 30000);
  afterAll(async () => { await app?.close(); });
  it('loads the authorized read models under the same RLS domains as the real destination pages', async () => {
    const response = await workingProfileStorage.run({ staffId: actor.id, roleId: profile.id,
      selectionRequired: false, requestMethod: 'GET', requestPath: '/dashboard/operational' }, async () => {
      const scope = app.get(GroupScopeService), access = await app.get(RbacService).effectiveAccess(actor);
      return scope.run(actor.id, access, () => app.get(DashboardService).operational(actor, '2026'));
    });
    expect(response.permissions).toMatchObject({ grades: true, approvals: true, overview: true, learnersOverview: true });
    expect(Object.keys(response.sources)).toEqual(expect.arrayContaining(['grouping', 'teaching', 'grades', 'approvals', 'learnersChart', 'sessionsChart', 'completionChart']));
    for (const [name, source] of Object.entries(response.sources)) expect({ name, status: (source as any).status }).toEqual({ name, status: 'ready' });
  });
  it('returns no data for an unselected profile and does not reuse the previous profile response', async () => {
    const response = await workingProfileStorage.run({ staffId: actor.id, roleId: null,
      selectionRequired: true, requestMethod: 'GET' }, () => app.get(DashboardService).operational(actor, '2026'));
    expect(response.sources).toEqual({});
    expect(Object.values(response.permissions)).not.toContain(true);
  });
});
