import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { ReportsController } from '../../src/reports/reports.controller.js';
import { LecturerPaymentService } from '../../src/reports/lecturer-payment.service.js';

const describeDb = process.env.RUN_LECTURER_PAYMENT_DB_TESTS === 'true' ? describe : describe.skip;
describeDb('Lecturer payments PostgreSQL', () => {
  let db: Sequelize;
  let tx: Transaction;
  let service: LecturerPaymentService;
  let app: INestApplicationContext;
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  beforeAll(async () => {
    if (!/\/pgsms_lecturer_payment_test_\d+$/.test(process.env.DATABASE_URL || '')) throw new Error('Use the isolated test database.');
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    db = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres', logging: false });
    tx = await db.transaction();
    const query = (sql: string, options: any = {}) => db.query(sql, { ...options, transaction: options.transaction || tx })
      .catch(error => { throw new Error(error.original?.message || error.message); });
    // Temporary fixtures shadow application tables; everything rolls back after this suite.
    await query(`CREATE TEMP TABLE course_offerings(id uuid PRIMARY KEY,subject_id uuid,name text,status text,completed_at timestamptz);
      CREATE TEMP TABLE subjects(id uuid PRIMARY KEY,name text);
      CREATE TEMP TABLE lecturers(id uuid PRIMARY KEY,name text,unit_id uuid);
      CREATE TEMP TABLE units(id uuid PRIMARY KEY,name text);
      CREATE TEMP TABLE class_groups(id uuid PRIMARY KEY,code text,name text);
      CREATE TEMP TABLE course_offering_class_groups(course_offering_id uuid,class_group_id uuid);
      CREATE TEMP TABLE teaching_sessions(id uuid PRIMARY KEY,course_offering_id uuid,lecturer_id uuid,status text,
        confirmed_at timestamptz,created_at timestamptz,session_date date,end_time time);
      CREATE TEMP TABLE lecturer_payments(course_offering_id uuid,lecturer_id uuid,paid boolean DEFAULT false,payment_date date,note text DEFAULT '',
        updated_by_staff_id uuid,created_at timestamptz,updated_at timestamptz,PRIMARY KEY(course_offering_id,lecturer_id));`);
    await query(`INSERT INTO subjects VALUES (:subject,'Subject');
      INSERT INTO units VALUES (:unit,'Unit'),(:emptyUnit,'Empty unit'),(:uncompletedUnit,'Unit');
      INSERT INTO lecturers VALUES (:l1,'An',:unit),(:l2,'Binh',NULL),(:uncompletedLecturer,'No completed class',:uncompletedUnit);
      INSERT INTO course_offerings VALUES (:o1,:subject,'Completed','completed','2026-11-02T18:00:00Z'),
        (:o2,:subject,'Other class','completed','2026-11-01T08:00:00Z'),(:o3,:subject,'Active','active',NULL);
      INSERT INTO teaching_sessions VALUES
        (:s1,:o1,:l1,'held','2026-11-02T10:00:00Z','2026-10-01','2026-11-02','12:00'),
        (:s2,:o1,:l1,'held','2026-11-02T11:00:00Z','2026-10-01','2026-11-02','17:00'),
        (:s3,:o1,:l2,'held','2026-11-02T10:00:00Z','2026-10-01','2026-11-02','12:00'),
        (:s4,:o1,:l1,'planned',NULL,'2026-10-01','2026-11-01','12:00'),
        (:s5,:o1,:l1,'not_held','2026-11-01','2026-10-01','2026-11-01','12:00'),
        (:s6,:o1,:l1,'held','2026-11-04','2026-10-01','2026-11-01','12:00'),
        (:s7,:o2,:l1,'held','2026-11-01T08:00:00Z','2026-10-01','2026-11-01','12:00'),
        (:s8,:o3,:l1,'held','2026-11-01','2026-10-01','2026-11-01','12:00'),
        (:s9,:o1,:l1,'held','2026-11-02T10:00:00Z','2026-10-01','2026-11-05','12:00'),
        (:s10,:o1,:l1,'held','2026-11-02T10:00:00Z','2026-11-04','2026-11-01','12:00');`,
    { replacements: { subject: id(1), unit: id(2), l1: id(3), l2: id(4), o1: id(5), o2: id(6), o3: id(7),
      emptyUnit: id(90), uncompletedUnit: id(91), uncompletedLecturer: id(92),
      ...Object.fromEntries(Array.from({ length: 10 }, (_, n) => [`s${n + 1}`, id(n + 10)])) } });
    service = new LecturerPaymentService({ query, transaction: (work: any) => db.transaction({ transaction: tx }, work) } as any);
  });
  afterAll(async () => { await tx?.rollback(); await db?.close(); await app?.close(); });

  it('resolves the real report controller and its shared scheduling dependency', () => {
    expect(app.get(ReportsController)).toBeInstanceOf(ReportsController);
    expect(app.get(LecturerPaymentService)).toBeInstanceOf(LecturerPaymentService);
  });

  it('counts only actual sessions recorded at completion, split by lecturer and offering', async () => {
    const { rows } = await service.list();
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.courseOfferingId === id(5) && r.lecturerId === id(3)).sessionCount).toBe(2);
    expect(rows.find(r => r.lecturerId === id(4)).sessionCount).toBe(1);
    expect(rows.every(r => r.paid === false)).toBe(true);
  });
  it('uses the local completion date including both boundaries, rather than teaching date', async () => {
    const { rows } = await service.list({ from: '2026-11-03', to: '2026-11-03' });
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.courseOfferingId === id(5))).toBe(true);
    expect((await service.list({ from: '2026-11-02', to: '2026-11-02' })).rows).toHaveLength(0);
  });
  it('filters units, lecturers and searches lecturer or offering names', async () => {
    expect((await service.list({ unitId: id(2) })).rows).toHaveLength(2);
    expect((await service.list({ lecturerId: id(4) })).rows).toHaveLength(1);
    expect((await service.list({ search: 'binh' })).rows).toHaveLength(1);
    expect((await service.list({ search: 'OTHER CLASS' })).rows).toHaveLength(1);
    expect((await service.list({ search: "%' OR true --" })).rows).toHaveLength(0);
    expect((await service.options()).lecturers).toHaveLength(2);
  });
  it('returns the entire unit catalog, including units with no lecturers or completed classes', async () => {
    const { units } = await service.options();
    expect(units).toEqual(expect.arrayContaining([
      { id: id(2), name: 'Unit' }, { id: id(90), name: 'Empty unit' }, { id: id(91), name: 'Unit' },
    ]));
    expect(units).toHaveLength(3);
    expect((await service.list({ unitId: id(90) })).rows).toHaveLength(0);
    expect((await service.list({ unitId: id(91) })).rows).toHaveLength(0);
    expect((await service.list({ unitId: id(2), lecturerId: id(4) })).rows).toHaveLength(0);
    expect((await service.list({ unitId: id(2), lecturerId: id(3), from: '2026-11-03', to: '2026-11-03', search: 'completed', paymentStatus: 'unpaid' })).rows).toHaveLength(1);
  });
  it('persists changes only for the selected pair; paid and unpaid filters follow saved state', async () => {
    await service.update(id(5), id(3), { paid: true, paymentVersion: null, paymentDate: '2026-11-01' }, id(99));
    expect((await service.list({ paymentStatus: 'paid' })).rows).toEqual([expect.objectContaining({ courseOfferingId: id(5), lecturerId: id(3), paid: true })]);
    expect((await service.list({ paymentStatus: 'unpaid' })).rows).toHaveLength(2);
    const saved = (await service.list({ paymentStatus: 'paid' })).rows[0];
    await service.update(id(5), id(3), { paid: false, paymentVersion: saved.paymentVersion }, id(99));
    expect((await service.list({ paymentStatus: 'paid' })).rows).toHaveLength(0);
    expect((await service.list()).rows.every(r => !r.paid)).toBe(true);
  });
  it('rejects an active offering or a lecturer without held sessions in the selected class', async () => {
    await expect(service.update(id(7), id(3), { paid: true, paymentVersion: null, paymentDate: '2026-11-01' }, id(99))).rejects.toThrow();
    await expect(service.update(id(6), id(4), { paid: true, paymentVersion: null, paymentDate: '2026-11-01' }, id(99))).rejects.toThrow();
  });

  it('returns actual custom offering names and linked groups without multiplying sessions; searches both group fields', async () => {
    await db.query(`UPDATE course_offerings SET name='Lớp tự đặt - không tách - tên' WHERE id=:offering;
      INSERT INTO class_groups VALUES (:g1,'CNTT-26','Công nghệ thông tin'),(:g2,'QTKD-26','Quản trị kinh doanh');
      INSERT INTO course_offering_class_groups VALUES (:offering,:g1),(:offering,:g2)`, {
      transaction: tx, replacements: { offering: id(5), g1: id(81), g2: id(82) },
    });
    for (const search of ['CNTT-26', 'Quản trị kinh doanh']) {
      const { rows } = await service.list({ search });
      expect(rows).toHaveLength(2);
      expect(rows[0].offeringName).toBe('Lớp tự đặt - không tách - tên');
      expect(rows[0].participatingGroups).toHaveLength(2);
      expect(rows.find(row => row.lecturerId === id(3)).sessionCount).toBe(2);
    }
  });

  it('saves notes independently, backdated payments and changed dates, then clears only the effective date', async () => {
    const row = () => service.list().then(({ rows }) => rows.find(r => r.courseOfferingId === id(5) && r.lecturerId === id(3)));
    let current = await row();
    const noteOnly = await service.update(id(5), id(3), { paid: false, note: 'Chờ chứng từ', paymentVersion: current.paymentVersion }, id(99));
    expect(noteOnly).toMatchObject({ paid: false, paymentDate: null, note: 'Chờ chứng từ', updatedByStaffId: id(99) });
    const paid = await service.update(id(5), id(3), { paid: true, paymentDate: '2026-10-29', paymentVersion: noteOnly.paymentVersion }, id(99));
    expect(paid).toMatchObject({ paymentDate: '2026-10-29', note: 'Chờ chứng từ' });
    const corrected = await service.update(id(5), id(3), { paid: true, paymentDate: '2026-10-28', paymentVersion: paid.paymentVersion }, id(99));
    expect((await row()).paymentDate).toBe('2026-10-28');
    const cleared = await service.update(id(5), id(3), { paid: false, paymentVersion: corrected.paymentVersion }, id(99));
    expect(cleared).toMatchObject({ paid: false, paymentDate: null, note: 'Chờ chứng từ' });
    expect((await service.list()).rows.filter(r => r.lecturerId === id(4) || r.courseOfferingId === id(6)).every(r => !r.paid && !r.note)).toBe(true);
  });

  it('keeps historical paid rows without invented dates and allows note edits or filling in the actual date', async () => {
    await db.query(`INSERT INTO lecturer_payments(course_offering_id,lecturer_id,paid,created_at,updated_at)
      VALUES(:offering,:lecturer,true,now(),now())`, { transaction: tx, replacements: { offering: id(5), lecturer: id(4) } });
    const legacy = (await service.list({ lecturerId: id(4) })).rows[0];
    expect(legacy).toMatchObject({ paid: true, paymentDate: null });
    const note = await service.update(id(5), id(4), { paid: true, note: 'Cần đối chiếu', paymentVersion: legacy.paymentVersion }, id(99));
    expect(note.paymentDate).toBeNull();
    const fixed = await service.update(id(5), id(4), { paid: true, paymentDate: '2026-10-20', paymentVersion: note.paymentVersion }, id(99));
    expect(fixed).toMatchObject({ paid: true, paymentDate: '2026-10-20', note: 'Cần đối chiếu' });
    expect((await service.list({ from: '2026-11-03', to: '2026-11-03' })).rows).toHaveLength(2);
  });

  it('rejects stale versions, missing or impossible payment dates and oversized notes without changing saved data', async () => {
    const current = (await service.list({ lecturerId: id(4) })).rows[0];
    for (const input of [
      { paid: true, paymentDate: '2026-02-30', paymentVersion: current.paymentVersion },
      { paid: true, paymentDate: null, paymentVersion: current.paymentVersion },
      { paid: true, note: 'x'.repeat(2001), paymentVersion: current.paymentVersion },
      { paid: false, paymentVersion: null },
    ]) await expect(service.update(id(5), id(4), input, id(99))).rejects.toThrow();
    expect((await service.list({ lecturerId: id(4) })).rows[0]).toMatchObject({ paid: true, paymentDate: '2026-10-20', note: 'Cần đối chiếu' });
  });
});
