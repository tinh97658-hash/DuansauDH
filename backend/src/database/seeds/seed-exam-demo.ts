import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueryTypes } from 'sequelize';
import { environmentFiles, environmentSchema } from '../../config/configuration.js';
import { requireDevelopment } from './scheduling-test-fixture.js';

// Separate, stable demo identities; reruns never reset an already initialized class.
const tag = 'DEMO-THI';
const id = (key: string) => {
  const h = createHash('sha256').update(`exam-demo-v1:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
const originalCases = [
  ['Đang giảng dạy', 'Triết học', 0],
  ['Chưa nhập điểm thành phần', 'Tiếng Anh', 1],
  ['Đang nhập điểm thành phần', 'Phương pháp nghiên cứu khoa học', 2],
  ['Đủ điểm, chưa gửi duyệt', 'Toán ứng dụng', 3],
  ['Tư cách chờ duyệt', 'Cơ sở dữ liệu nâng cao', 4],
  ['Sẵn sàng tạo lịch thi – lớp ghép', 'Trí tuệ nhân tạo', 5],
  ['Sẵn sàng tạo lịch thi – lớp riêng', 'Mạng máy tính nâng cao', 5],
  ['Đã có lịch thi sắp tới', 'An toàn thông tin', 6],
  ['Đã thi, chưa nhập điểm thi', 'Công nghệ phần mềm', 7],
  ['Đang nhập điểm thi', 'Phân tích dữ liệu', 8],
  ['Đủ điểm thi, chưa gửi duyệt', 'Hệ thống thông tin', 9],
  ['Kết quả chờ duyệt', 'Điện toán đám mây', 10],
  ['Đã duyệt kết quả', 'Học máy nâng cao', 11],
] as const;

const extraNames = [
  'Xử lý ảnh số', 'Thị giác máy tính', 'Xử lý ngôn ngữ tự nhiên', 'Khai phá dữ liệu', 'Dữ liệu lớn', 'Hệ phân tán',
  'Tối ưu hóa', 'Mô phỏng hệ thống', 'Quản trị dự án phần mềm', 'Kiểm thử phần mềm', 'Kiến trúc phần mềm', 'Thiết kế thuật toán',
  'Cơ sở dữ liệu phân tán', 'Mạng không dây', 'An ninh mạng', 'Mật mã ứng dụng', 'Ứng dụng trí tuệ nhân tạo', 'Học sâu',
  'Robot thông minh', 'Hệ thống nhúng', 'Internet vạn vật', 'Tính toán song song', 'Tính toán hiệu năng cao', 'Kỹ thuật lập trình',
  'Phân tích hệ thống', 'Quản trị dữ liệu', 'Kho dữ liệu', 'Hệ hỗ trợ quyết định', 'Truy hồi thông tin', 'Công nghệ web',
  'Công nghệ di động', 'Phương pháp tính', 'Thống kê ứng dụng', 'Nghiên cứu thực nghiệm', 'Đồ họa máy tính', 'Quản lý chất lượng phần mềm',
];
const labels:Record<number,string> = {0:'Đang giảng dạy',1:'Chưa nhập điểm thành phần',2:'Đang nhập điểm thành phần',3:'Đủ điểm, chưa gửi duyệt',4:'Tư cách chờ duyệt',5:'Chờ xếp lịch thi',6:'Sắp thi – chờ thi và nhập điểm',7:'Đã thi – chờ nhập điểm thi',8:'Đã thi – đang nhập điểm',9:'Đủ điểm thi, chưa gửi duyệt',10:'Kết quả chờ duyệt',11:'Đã duyệt kết quả'};
const extraStages = [5,6,7,8,9,10,0,1,2,3,4,11];
const cases:Array<readonly [string,string,number]> = [...originalCases,
  ...extraNames.map((name,n):[string,string,number]=>{
    const stage = n<30 ? extraStages[n%6] : extraStages[n-24];
    return [labels[stage],name,stage];
  }),
];
const batchFor = (i:number) => Math.floor((i-originalCases.length)/6);
const groupFor = (i:number) => i<originalCases.length ? (i===5?0:i%2) : 2+batchFor(i);
const groupsFor = (i:number) => i===5?[0,1]:[groupFor(i)];
const curriculumKey = (g:number) => g<2?'curriculum':`curriculum:${g}`;
const lecturerFor = (i:number) => i<originalCases.length?i%3:3+batchFor(i);
const roomFor = (i:number) => i<originalCases.length?0:3+i-originalCases.length;
const teachingOffset = (i:number,s:number,stage:number) => stage===0?(s<4?-6+s:3+s):i<originalCases.length?(-21-i*12+s):(-105+(i-originalCases.length)%6*12+s);

async function run() {
  if (process.argv.length > 2) throw new Error('Seed không nhận tùy chọn reset/xóa dữ liệu.');
  await ConfigModule.forRoot({envFilePath:environmentFiles, expandVariables:true, validate:config => {
    requireDevelopment(config.NODE_ENV ?? 'development');
    const {value,error} = environmentSchema.validate(config);
    if (error) throw new Error('Cấu hình backend không hợp lệ.');
    if (!['localhost','127.0.0.1','[::1]'].includes(new URL(value.DATABASE_URL).hostname)) throw new Error('Chỉ seed database development trên máy local.');
    return value;
  }});
  const [{NestFactory},{getConnectionToken},{AppModule},{ExamGradebookService},{ExamScheduleService}] = await Promise.all([
    import('@nestjs/core'), import('@nestjs/sequelize'), import('../../app.module.js'),
    import('../../masters/exam-gradebook.service.js'), import('../../masters/exam-schedule.service.js'),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule,{logger:false});
  try {
    requireDevelopment(app.get(ConfigService).get('NODE_ENV'));
    const db = app.get<import('sequelize-typescript').Sequelize>(getConnectionToken());
    db.options.logging = false;
    const grades = app.get(ExamGradebookService), schedule = app.get(ExamScheduleService);
    const m = db.models;
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const date = (offset:number) => new Date(Date.parse(`${today}T12:00:00Z`) + offset*86400000).toISOString().slice(0,10);
    let created = 0;
    await db.transaction(async transaction => {
      await db.query('SELECT pg_advisory_xact_lock(21026)',{transaction});
      const add = async (model:string,key:string,values:any) => {
        try {
          const [,inserted] = await m[model].findOrCreate({where:{id:id(key)},defaults:{id:id(key),...values},transaction});
          if(inserted) created++;
        } catch(error:any) {
          throw new Error(`${model}/${key}: ${error.original?.message||error.parent?.message||error.errors?.map((item:any)=>item.message).join('; ')||error.message}`);
        }
      };
      await add('Staff','actor',{name:'DEMO-THI Người duyệt dữ liệu mẫu',email:'demo-thi-actor@example.invalid',role:'admin',password:null});
      await add('Discipline','discipline',{code:tag,name:'Ngành minh họa quy trình thi',active:true});
      await add('Major','major',{code:tag,name:'DEMO-THI Công nghệ thông tin',disciplineId:id('discipline'),program:'masters',active:true});
      await add('Curriculum','curriculum',{code:tag,name:'DEMO-THI Chương trình minh họa',majorId:id('major'),program:'masters',applicableFromYear:'2026',totalCredits:39,active:true});
      await add('CurriculumBlock','block',{curriculumId:id('curriculum'),code:'CN',name:'Kiến thức chuyên ngành',minCredits:0});
      for(let g=0;g<8;g++) {
        // A user may have moved/removed demo learners since the previous run.
        // Do not reconstruct an existing cohort and undo those actions.
        if(await m.ClassGroup.findByPk(id(`group:${g}`),{transaction})) continue;
        if(g>=2) {
          await add('Curriculum',curriculumKey(g),{code:`DTHI-CT-${g+1}`,name:`DEMO-THI Chương trình minh họa nhóm ${g+1}`,majorId:id('major'),program:'masters',applicableFromYear:'2026',totalCredits:18,active:true});
          await add('CurriculumBlock',`block:${g}`,{curriculumId:id(curriculumKey(g)),code:'CN',name:'Kiến thức chuyên ngành',minCredits:0});
        }
        await add('ClassGroup',`group:${g}`,{code:`${tag}-2026.${g+1}`,name:`DEMO-THI CNTT 2026.${g+1}`,majorId:id('major'),curriculumId:id(curriculumKey(g)),program:'masters',academicYear:'2026',status:'open',maxStudents:30,allowedWeekdays:[0,1,2,3,4,5,6]});
        for(let n=0;n<(g<2?12:18);n++) {
          const key=`learner:${g}:${n}`;
          const firstNames=['An','Bình','Chi','Dũng','Hà','Hải','Lan','Linh','Minh','Nam','Phương','Trang'];
          const lastName=g<2?`${g?'Trần':'Nguyễn'} Minh`:`${['Lê','Phạm','Võ','Đặng','Bùi','Hoàng'][g-2]} ${n<12?'Minh':'Ngọc'}`;
          await add('AdmissionRecord',key,{code:`DTHI${g+1}${String(n+1).padStart(3,'0')}`,fullName:`${lastName} ${firstNames[n%12]}`,lastName,firstName:firstNames[n%12],dob:`${1995+n%5}-0${n%9+1}-15`,gender:n%2?'Nữ':'Nam',email:`demo-thi-${g}-${n}@example.invalid`,majorId:id('major'),majorName:'DEMO-THI Công nghệ thông tin',trainingLevel:'Thạc sĩ',academicYear:'2026',status:'approved',studyStatus:'Đang học',extraData:{seed:tag},note:'DEMO-THI dữ liệu giả để demo'});
          await add('ClassGroupMember',`member:${g}:${n}`,{classGroupId:id(`group:${g}`),admissionRecordId:id(key),studentId:null,enrolledAt:`${date(-220)}T00:00:00Z`});
        }
      }
      for(let i=0;i<3;i++) {
        await add('Room',`room:${i}`,{code:`${tag}-P${i+1}`,name:`DEMO-THI Phòng ${i+1}`,capacity:i===0?40:i===1?20:10,isActive:true});
        await add('Lecturer',`lecturer:${i}`,{code:`${tag}-GV${i+1}`,name:`DEMO-THI ${['Nguyễn Văn Hùng','Trần Thị Mai','Lê Minh Tuấn'][i]}`,majorId:id('major'),disciplineId:id('discipline'),academicDegree:'Tiến sĩ',active:true});
      }
      for(let b=0;b<6;b++) await add('Lecturer',`lecturer:${3+b}`,{code:`${tag}-GV${4+b}`,name:`DEMO-THI Giảng viên nhóm ${b+3}`,majorId:id('major'),disciplineId:id('discipline'),academicDegree:'Tiến sĩ',active:true});
      for(let n=0;n<extraNames.length;n++) await add('Room',`room:${3+n}`,{code:`${tag}-P${4+n}`,name:`DEMO-THI Phòng ${4+n}`,capacity:24,isActive:true});
      for(const [i,[label,name,stage]] of cases.entries()) {
        await add('Subject',`subject:${i}`,{code:`DTHI${String(i+1).padStart(2,'0')}`,codeText:`DTHI${String(i+1).padStart(2,'0')}`,codeNumber:i+1,name,majorId:id('major'),program:'masters',credits:3,majorAssignment:true,active:true});
        const g=groupFor(i);
        await add('CurriculumSubject',`entry:${i}`,{curriculumId:id(curriculumKey(g)),blockId:id(g<2?'block':`block:${g}`),subjectId:id(`subject:${i}`),isRequired:true,credits:3,sortOrder:i});
        await add('CourseOffering',`offering:${i}`,{subjectId:id(`subject:${i}`),name:`DEMO-THI ${String(i+1).padStart(2,'0')} | ${name} | ${label}`,note:tag,status:stage===0?'active':'completed',completedAt:stage===0?null:`${date(teachingOffset(i,8,stage)+1)}T05:00:00Z`,completedByStaffId:stage===0?null:id('actor')});
        for(const g of groupsFor(i)) await add('CourseOfferingClassGroup',`link:${i}:${g}`,{courseOfferingId:id(`offering:${i}`),classGroupId:id(`group:${g}`)});
        // 3 credits = 45 periods: nine five-period sessions with room, teacher and confirmation.
        for(let s=0;s<9;s++) {
          const offset=teachingOffset(i,s,stage);
          const held=stage!==0||s<4;
          await add('TeachingSession',`teaching:${i}:${s}`,{courseOfferingId:id(`offering:${i}`),sessionDate:date(offset),period:'MORNING',startTime:'07:00:00',endTime:'11:10:00',lecturerId:id(`lecturer:${lecturerFor(i)}`),roomId:id(`room:${roomFor(i)}`),status:held?'held':'planned',confirmedAt:held?`${date(offset)}T05:00:00Z`:null,confirmedByStaffId:held?id('actor'):null,note:`DEMO-THI Buổi ${s+1}/9 – 5 tiết`});
        }
      }
    });
    const actor:any = await m.Staff.findByPk(id('actor'));
    const report:any[]=[];
    for(const [i,[label,,stage]] of cases.entries()) {
      const offering:any=await m.CourseOffering.findByPk(id(`offering:${i}`));
      const scope={classGroupId:id(`group:${groupFor(i)}`),courseOfferingId:offering.id,rosterScope:'offering' as const};
      const read=async():Promise<any>=>{
        const book=await grades.get({...scope,page:1,pageSize:15});
        const rows=[...book.rows];
        for(let page=2;rows.length<book.totalRows;page++) rows.push(...(await grades.get({...scope,page,pageSize:15})).rows);
        return {...book,rows};
      };
      const transition=async(phase:'eligibility'|'final',action:'submit'|'approve')=>{
        const book=await read();
        await grades.transition({...scope,revision:book.revision,version:book.workflow[phase].version,action},actor,phase);
      };
      if(!offering.note?.includes('[initialized]')) {
        if(stage>=2) {
          let book=await read();
          if(book.workflow.eligibility.status==='draft') {
            await grades.save({...scope,revision:book.revision,rows:book.rows.filter((_,n)=>stage!==2||n<5).map((row:any,n:number)=>({participantId:row.participantId,testScore:n===11?3:6+n%5,assignmentScore:7+n%4,examScore:null,examExempt:false,letterGrade:'',attemptScores:[],result:'pending' as const,policyVersion:row.eligibilityPolicy.version,policyRulesVersion:row.eligibilityPolicy.rulesVersion}))},actor);
          }
          book=await read();
          if(stage>=4&&book.workflow.eligibility.status==='draft') await transition('eligibility','submit');
          book=await read();
          if(stage>=5&&book.workflow.eligibility.status==='submitted') await transition('eligibility','approve');
          if(stage>=6) {
            book=await read();
            const [existing]:any[]=await db.query('SELECT id,status FROM course_exam_sessions WHERE course_offering_id=:id ORDER BY created_at LIMIT 1',{replacements:{id:offering.id},type:QueryTypes.SELECT});
            const exam=existing||await schedule.schedule({courseOfferingId:offering.id,snapshotId:book.workflow.eligibility.snapshotId,eligibilityVersion:book.workflow.eligibility.version,examDate:date(i>=originalCases.length&&stage===6?2+batchFor(i):i+7),startTime:'08:00',endTime:'10:00',roomId:id(`room:${roomFor(i)}`),lecturerId:id(`lecturer:${lecturerFor(i)}`),note:'DEMO-THI Lịch thi mẫu'},actor);
            if(stage>=7) {
              // Only this seed's synthetic session is backdated to populate real historical demos.
              // Confirmation and subsequent score workflows use the production services.
              await db.query(`UPDATE course_exam_sessions SET exam_date=:date WHERE id=:exam AND course_offering_id=:offering AND status='scheduled'`,{replacements:{date:date(i<originalCases.length?-i+1:-2-(i-originalCases.length)%6),exam:exam.id,offering:offering.id}});
              if(!existing||existing.status==='scheduled') await schedule.confirm(exam.id,{version:0,status:'held',note:'DEMO-THI Xác nhận lịch sử thi giả lập'},actor);
            }
            if(stage>=8) {
              book=await read();
              if(book.workflow.final.status==='draft') await grades.save({...scope,revision:book.revision,rows:book.rows.filter((row:any,n:number)=>row.eligible===true&&(stage!==8||n<5)).map((row:any,n:number)=>({participantId:row.participantId,testScore:row.testScore,assignmentScore:row.assignmentScore,examScore:n===0?3:6+n%5,examExempt:row.examExempt,letterGrade:'',attemptScores:[],result:'pending' as const}))},actor);
            }
            book=await read();
            if(stage>=10&&book.workflow.final.status==='draft') await transition('final','submit');
            book=await read();
            if(stage>=11&&book.workflow.final.status==='submitted') await transition('final','approve');
          }
        }
        await offering.update({note:`${tag} [initialized]`});
      }
      const book=await read();
      report.push({name:offering.name,students:book.totalRows,eligibility:book.workflow.eligibility.status,final:book.workflow.final.status});
    }
    const calendar=await schedule.list({from:date(-20),to:date(35)});
    const queue=calendar.queue.filter((item:any)=>String(item.name).startsWith(tag));
    console.table(report);
    console.log(JSON.stringify({created,offerings:cases.length,learners:132,teachingSessions:cases.length*9,readyForExam:queue.map((item:any)=>({name:item.name,candidates:item.remainingCount})),filter:{major:'DEMO-THI Công nghệ thông tin',year:'2026'}},null,2));
  } finally {await app.close();}
}
run().catch(error=>{console.error(`[exam-demo] ${error.original?.message||error.message}`);process.exitCode=1;});
