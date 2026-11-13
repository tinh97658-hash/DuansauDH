import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { setTimeout as delay } from 'node:timers/promises';
import { QueryTypes } from 'sequelize';
import { AppModule } from '../../src/app.module.js';
import { SubjectRecognitionService } from '../../src/plan/subject-recognition.service.js';

const describeDb = process.env.RUN_POSTGRES_RECOGNITION_TESTS === 'true' ? describe : describe.skip;

describeDb('Recognition decisions on the assigned curriculum, using migrated PostgreSQL', () => {
  let app: INestApplicationContext, db: Sequelize, service: SubjectRecognitionService;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || 'postgres://invalid');
    if (url.hostname !== '127.0.0.1' || url.username !== 'pgsms_ci' || !/^\/pgsms_ci_test_\d+$/.test(url.pathname)) {
      throw new Error('Use the dedicated disposable PostgreSQL runner.');
    }
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    db = app.get(getConnectionToken()); service = app.get(SubjectRecognitionService);
  });
  afterAll(async () => { await app?.close(); });

  const fixture = async () => {
    const m = db.models;
    const code = randomUUID().slice(0, 8);
    const discipline = await m.Discipline.create({ code, name: 'Recognition test' });
    const major = await m.Major.create({ code, name: 'Recognition test', disciplineId: discipline.id, program: 'masters' });
    const curriculum = await m.Curriculum.create({ code, name: 'Assigned curriculum', majorId: major.id, program: 'masters', applicableFromYear: '2026' });
    const block = await m.CurriculumBlock.create({ curriculumId: curriculum.id, code: 'CN', name: 'Core' });
    const makeSubject = (n: number) => m.Subject.create({ code: `${code}${n}`, codeNumber: n, codeText: `${code}${n}`, name: `Subject ${n}`, majorId: major.id, program: 'masters' });
    const original = await makeSubject(1), replacement = await makeSubject(2), outside = await makeSubject(3);
    for (const subject of [original, replacement]) await m.CurriculumSubject.create({ curriculumId: curriculum.id, blockId: block.id, subjectId: subject.id });
    const record = await m.AdmissionRecord.create({ fullName: 'Synthetic recognition learner', majorId: major.id, trainingLevel: 'Thạc sĩ', academicYear: '2026' });
    const group = await m.ClassGroup.create({ code, name: 'Recognition class', program: 'masters', majorId: major.id, academicYear: '2026', curriculumId: curriculum.id });
    await m.ClassGroupMember.create({ classGroupId: group.id, admissionRecordId: record.id });
    const learning = await m.LearnerSubjectResult.create({ admissionRecordId: record.id, subjectId: original.id, sourceType: 'external',
      status: 'completed', result: 'passed', score: 8, completedAt: '2026-11-01' });
    const recognition = await m.SubjectRecognition.create({ admissionRecordId: record.id, learningResultId: learning.id,
      sourceSubjectId: original.id, targetSubjectId: original.id, sourceType: 'external', basis: 'same_name', status: 'pending' });
    return { curriculum, block, original, replacement, outside, record, recognition, major };
  };

  it('rejects a real subject outside the assigned curriculum without modifying the pending decision', async () => {
    const f = await fixture();
    await expect(service.decide(f.recognition.id, { decision: 'approved', targetSubjectId: f.outside.id })).rejects.toThrow('không thuộc CTĐT');
    await f.recognition.reload();
    expect(f.recognition).toMatchObject({ status: 'pending', targetSubjectId: f.original.id, decidedAt: null });
  });

  it('revalidates an unchanged target when it has been removed from the curriculum', async () => {
    const f = await fixture();
    await db.models.CurriculumSubject.destroy({ where: { curriculumId: f.curriculum.id, subjectId: f.original.id } });
    await expect(service.decide(f.recognition.id, { decision: 'approved' })).rejects.toThrow('không thuộc CTĐT');
    expect((await f.recognition.reload()).status).toBe('pending');
  });

  it('approves a valid replacement using the assigned curriculum even when another curriculum exists', async () => {
    const f = await fixture();
    await db.models.Curriculum.create({ code: randomUUID(), name: 'Newer curriculum', majorId: f.major.id, program: 'masters', applicableFromYear: '2026' });
    await service.decide(f.recognition.id, { decision: 'approved', targetSubjectId: f.replacement.id });
    expect(await f.recognition.reload()).toMatchObject({ status: 'approved', targetSubjectId: f.replacement.id });
    expect(f.recognition.decidedAt).toBeTruthy();
  });

  it('waits for a concurrent curriculum edit, then rejects a target removed by that edit', async () => {
    const f = await fixture();
    const edit = await db.transaction();
    let decision: Promise<unknown> | undefined;
    try {
      await db.query('SELECT pg_advisory_xact_lock(714062)', { transaction: edit });
      await db.models.CurriculumSubject.destroy({ where: { curriculumId: f.curriculum.id, subjectId: f.original.id }, transaction: edit });
      decision = service.decide(f.recognition.id, { decision: 'approved' }).then(
        () => ({ approved: true }), error => ({ error }),
      );
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const [state] = await db.query<{ waiting: boolean }>(`SELECT EXISTS(SELECT 1 FROM pg_locks
          WHERE locktype='advisory' AND NOT granted AND objid=714062
            AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS waiting`, { type: QueryTypes.SELECT });
        waiting = state.waiting;
        if (!waiting) await delay(10);
      }
      expect(waiting).toBe(true);
      await edit.commit();
      expect(await decision).toMatchObject({ error: { status: 409, message: expect.stringContaining('không thuộc CTĐT') } });
      expect(await f.recognition.reload()).toMatchObject({ status: 'pending', targetSubjectId: f.original.id });
    } finally {
      if (!(edit as any).finished) await edit.rollback();
      await decision;
    }
  });
});
