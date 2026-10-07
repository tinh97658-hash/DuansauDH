const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../backend/package.json'));
req('reflect-metadata');
const { NestFactory } = req('@nestjs/core');
const { getConnectionToken } = req('@nestjs/sequelize');
const { AppModule } = req(path.resolve(__dirname, '../backend/dist/app.module.js'));
const { ExamGradebookService } = req(path.resolve(__dirname, '../backend/dist/masters/exam-gradebook.service.js'));
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    app.get(getConnectionToken()).options.logging = false;
    const service = app.get(ExamGradebookService);
    const options = await service.options();
    const firstGroup = options.groups.find(group => options.courseOfferings.some(offering => offering.groupLinks.some(link => link.classGroupId === group.id)));
    const firstOffering = options.courseOfferings.find(offering => offering.groupLinks.some(link => link.classGroupId === firstGroup?.id));
    const gradebook = firstOffering ? await service.get({ classGroupId: firstGroup.id, courseOfferingId: firstOffering.id }) : null;
    if (!gradebook || gradebook.rows.length > 15) throw new Error('Trang đầu không hợp lệ');
    const scope = { classGroupId: firstGroup.id, courseOfferingId: firstOffering.id };
    const second = await service.get({ ...scope, page: 2 });
    if (second.rows.length > 15) throw new Error('Trang hai vượt giới hạn');
    if (second.page === 2 && second.rows.some(row => gradebook.rows.some(first => first.participantId === row.participantId))) throw new Error('Hai trang bị trùng học viên');
    const searched = await service.get({ ...scope, search: second.rows[0]?.code || gradebook.rows[0]?.code });
    const capped = await service.get({ ...scope, pageSize: 100 });
    if (capped.rows.length > 15) throw new Error('Không giới hạn pageSize');
    const outside = await service.get({ ...scope, page: 999 });
    const included = await service.get({ ...scope, mode: 'exam', includeIds: gradebook.rows[0].participantId });
    if (!included.rows.some(row => row.participantId === gradebook.rows[0].participantId)) throw new Error('Không giữ lựa chọn tư cách thi chưa lưu');
    console.log(JSON.stringify({ groups: options.groups.length, courseOfferings: options.courseOfferings.length, total: gradebook.total, page1: gradebook.rows.length, page2: second.rows.length, searchRows: searched.rows.length, clampedPage: outside.page, pageSizeCap: capped.pageSize, verified: true }));
  } finally { await app.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
