const fs=require("node:fs"),path=require("node:path"),{parseEnv}=require("node:util"),{pathToFileURL}=require("node:url");
(async()=>{
Object.assign(process.env,parseEnv(fs.readFileSync("../.env","utf8")),{NODE_ENV:"test"});
const imp=async(f,n)=>(await import(pathToFileURL(path.resolve("dist/"+f+".js")).href))[n];
const {NestFactory}=await import("@nestjs/core");
const app=await NestFactory.createApplicationContext(await imp("app.module","AppModule"),{logger:false});
try{
const model=(f,n)=>imp("database/models/"+f,n);
const Major=await model("common/major.model","Major"),Subject=await model("plan/subject.model","Subject"),Student=await model("student.model","Student"),Admission=await model("plan/admission-record.model","AdmissionRecord"),Group=await model("training/class-group.model","ClassGroup"),Member=await model("training/class-group-member.model","ClassGroupMember"),Package=await model("plan/subject-package.model","SubjectPackage"),Entry=await model("plan/subject-package-subject.model","SubjectPackageSubject"),Room=await model("common/room.model","Room"),Lecturer=await model("common/lecturer.model","Lecturer");
const source=fs.readFileSync("src/database/seed-demo.ts","utf8");
const section=source.slice(source.indexOf("const subjectDefs:"),source.indexOf("const subjects = []"));
const rows=section.split(/\r?\n/).filter(l=>/^\s*\[\d+,/.test(l)).map(l=>JSON.parse(l.trim().replace(/,$/,"")));
if(rows.length!==30)throw Error("Expected the 30 existing curriculum entries; review source before seeding.");
const state={source:"backend/src/database/seed-demo.ts:241",year:"2026",subjects:[],groups:[],students:[]};
await Major.sequelize.transaction(async transaction=>{
const [major]=await Major.findOrCreate({where:{code:"KTHH",program:"masters"},defaults:{name:"Khai thác hàng hải",active:true},transaction});state.majorId=major.id;state.majorName=major.name;
for(const [codeNumber,codeText,name,credits,subjectType,isRequired,majorAssignment] of rows){
const [s]=await Subject.findOrCreate({where:{majorId:major.id,program:"masters",codeNumber},defaults:{code:codeText,codeText,name,credits,subjectType,isRequired,majorAssignment,sortOrder:codeNumber-501,active:true},transaction});
if(s.name!==name||s.code!==codeText||s.credits!==credits)throw Error("Existing curriculum entry differs; preserve user data and review "+codeText);
state.subjects.push({id:s.id,code:s.code,name:s.name,credits:s.credits});
}
const names=["Nguyễn Văn An","Trần Thị Bình","Lê Quang Cường","Phạm Thu Dung","Hoàng Văn Đạt","Vũ Thị Hà"];
for(let i=0;i<names.length;i++){
const regNo="K32-HV"+String(i+1).padStart(3,"0");
const [s]=await Student.findOrCreate({where:{regNo},defaults:{fullName:names[i],nameWithInitials:names[i],postalAddress:"Hồ sơ minh họa local",email:"k32-hv"+(i+1)+"@example.test",telNo:"000000",password:"disabled-local-demo-login",accountType:"registered",approvalState:"approved"},transaction});
const [a]=await Admission.findOrCreate({where:{code:"K32-HS"+(i+1)},defaults:{fullName:s.fullName,email:s.email,majorId:major.id,academicYear:"2026",status:"approved",trainingLevel:"Thạc sĩ",studentId:s.id},transaction});
state.students.push({id:s.id,admissionRecordId:a.id,regNo:s.regNo,fullName:s.fullName});
}
const definitions=[
{code:"THS-K32-N01",name:"Lớp Thạc sĩ 1 - 2026",members:[0,1,2],canMerge:true},
{code:"THS-K32-N02",name:"Lớp Thạc sĩ 2 - 2026",members:[1,3],canMerge:true},
{code:"THS-K32-RIENG",name:"Lớp Thạc sĩ học riêng - 2026",members:[4,5],canMerge:false}
];
for(const definition of definitions){
const [g]=await Group.findOrCreate({where:{code:definition.code,program:"masters"},defaults:{name:definition.name,majorId:major.id,academicYear:"2026",term:null,maxStudents:40,status:"open",note:"Lớp minh họa local, học phần từ danh mục repository"},transaction});
if(g.majorId!==major.id)throw Error("Existing group differs; preserve "+g.code);
const [pkg]=await Package.findOrCreate({where:{code:"G1-"+definition.code,classGroupId:g.id},defaults:{name:"Gói học phần Khai thác hàng hải",majorId:major.id,totalSubjects:21,active:true,isOfficial:true,canMerge:definition.canMerge},transaction});
for(const [i,s] of state.subjects.slice(0,21).entries())await Entry.findOrCreate({where:{packageId:pkg.id,subjectId:s.id},defaults:{sortOrder:i+1},transaction});
for(const i of definition.members){const student=state.students[i];await Member.findOrCreate({where:{classGroupId:g.id,studentId:student.id},defaults:{admissionRecordId:student.admissionRecordId},transaction});}
state.groups.push({id:g.id,code:g.code,name:g.name,canMerge:pkg.canMerge,packageId:pkg.id,packageCode:pkg.code});
}
const [room]=await Room.findOrCreate({where:{code:"K32-P301"},defaults:{name:"Phòng học khóa 32",capacity:40,isActive:true},transaction});
const [lecturer]=await Lecturer.findOrCreate({where:{code:"K32-GV01"},defaults:{name:"Giảng viên phụ trách khóa 32",active:true},transaction});
state.roomId=room.id;state.roomCode=room.code;state.lecturerId=lecturer.id;state.lecturerName=lecturer.name;
// Archive only unchanged synthetic subjects created by the previous local check.
// Keep groups, their user-edited names/packages, old offerings and their sessions intact.
const old=(await Subject.findAll({transaction})).filter(s=>/^QA772626HP\d+$/.test(s.code)&&/^Học phần kiểm thử QA772626 \d+$/.test(s.name));
state.archivedSubjects=old.map(s=>({id:s.id,code:s.code,name:s.name}));
for(const s of old)await s.update({active:false},{transaction});
});
fs.mkdirSync("coverage",{recursive:true});
const manifest="coverage/real-demo.json";
const prior=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest,"utf8")):{};
fs.writeFileSync(manifest,JSON.stringify({...prior,...state},null,2));
console.log("Seeded/reused "+state.subjects.length+" source curriculum entries, "+state.groups.length+" groups, "+state.students.length+" demo learners. Archived "+state.archivedSubjects.length+" unchanged synthetic subjects. Preserved all source memberships/history.");
}finally{await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});