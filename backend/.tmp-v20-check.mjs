import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { AppModule } from './dist/app.module.js';
import { SchedulingService } from './dist/scheduling/scheduling.service.js';
import { readRetakes } from './dist/scheduling/retake-policy.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
try {
  const db = app.get(getConnectionToken());
  db.options.logging = false;
  const service = app.get(SchedulingService);
  const offerings = await service.listCourseOfferings({ program: 'masters' });
  const scopes = await db.query("SELECT DISTINCT major_id, academic_year FROM class_groups WHERE program='masters' AND major_id IS NOT NULL AND academic_year IS NOT NULL LIMIT 3", { type: QueryTypes.SELECT });
  const candidates = [];
  for (const scope of scopes) candidates.push((await service.listCourseOfferingCandidates({ program: 'masters', majorId: scope.major_id, academicYear: scope.academic_year })).subjects.length);
  let rosterCount = null;
  if (offerings[0]) {
    rosterCount = (await service.getCourseOfferingRoster(offerings[0].id)).participantCount;
    await readRetakes(db, offerings[0].subjectId);
  } else await readRetakes(db, '00000000-0000-0000-0000-000000000000');
  const retakes = await db.query('SELECT COUNT(*)::integer AS count FROM scheduling_retakes', { type: QueryTypes.SELECT });
  console.log(JSON.stringify({ offerings: offerings.length, candidateCounts: candidates, checkedRosterCount: rosterCount, retakeRequests: retakes[0].count, databaseQueries: 'passed' }));
} finally { await app.close(); }
