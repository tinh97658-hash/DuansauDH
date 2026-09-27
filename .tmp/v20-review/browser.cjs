const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '../..');
const build = path.join(root, 'frontend/build');
const major = { id: 'major', code: 'KTHH', name: 'Khai thác hàng hải', active: true };
const groups = [1, 2, 3].map(n => ({ id: 'group'+n, code: 'KTHH-2026-N0'+n, name: 'Nhóm '+n, majorId: 'major', major, academicYear: '2026', term: 'HK1', allowedWeekdays: [1,2,3,4,5], memberCount: 20, groupType: 'ADMINISTRATIVE' }));
const subject = { id: 'subject', code: 'HP01', name: 'Khai thác cảng và vận tải biển' };
const offering = { id: 'offering', subject, status: 'active', participantCount: 20, groupLinks: [{ classGroupId: 'group1', classGroup: groups[0] }], sessionSummary: { heldCount: 2, pendingCount: 0 }, allowedWeekdays: [1,2,3,4,5] };
const participants = Array.from({length:20}, (_,n) => ({id:'student:'+n,code:'HV'+(n+1).toString().padStart(3,'0'),fullName:['Nguyễn Văn An','Trần Thị Bình','Lê Minh Châu'][n%3],note:''}));
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let data = [];
    if (url.pathname.endsWith('/auth/session')) data = { authenticated:true,user:{name:'Chuyên viên',role:'admin',canManageScheduling:true} };
    else if(url.pathname.endsWith('/auth/isStaff')) data = {message:'admin'};
    else if(url.pathname.endsWith('/system/majors')) data=[major];
    else if(url.pathname.endsWith('/masters/class-groups')) data=groups;
    else if(url.pathname.endsWith('/course-offering-candidates')) data={subjects:[{subject,eligibleClassGroups:groups}]};
    else if(url.pathname.endsWith('/roster-preview') || url.pathname.endsWith('/roster')) data={participants,participantCount:20};
    else if(url.pathname.endsWith('/course-offerings')) data=req.method==='POST'?offering:[offering];
    else if(url.pathname.endsWith('/course-offerings/offering')) data=offering;
    else if(url.pathname.endsWith('/lecturers')) data=[{id:'lecturer',name:'Nguyễn Bình',active:true}];
    else if(url.pathname.endsWith('/rooms')) data=Array.from({length:12},(_,n)=>({id:'room'+n,code:String(301+n),capacity:n%4===0?10:40,isActive:true}));
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return;
  }
  let file=path.resolve(build,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(build)) {res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory()) file=path.join(build,'index.html');
  const ext=path.extname(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let browser, socket;
(async()=>{
  await new Promise(r=>server.listen(4187,'127.0.0.1',r));
  browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9227','--user-data-dir='+path.join(__dirname,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
  let tabs;
  for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:9227/json')).json();break;}catch{await delay(500);}}
  if(!tabs)throw new Error('Browser did not start');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let next=0;const calls=new Map();const errors=[];
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const c=calls.get(m.id);calls.delete(m.id);m.error?c.reject(m.error):c.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;calls.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const until=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(150);}throw new Error('Timeout: '+expression);};
  await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:4187/masters/course-offerings'});
  await until(`!!document.querySelector('input[aria-label="Chọn chuyên ngành"]')`);
  await evaluate(`document.querySelector('input[aria-label="Chọn chuyên ngành"]').focus()`);
  await until(`!!document.querySelector('[role="option"]')`);
  await evaluate(`document.querySelector('[role="option"]').click()`);
  await until(`document.querySelector('select[aria-label="Khóa / Năm học"]')?.options.length>1`);
  await evaluate(`(()=>{const e=document.querySelector('select[aria-label="Khóa / Năm học"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'2026');e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await until(`!!document.querySelector('.sl-create-v17-subject-card')`);
  await evaluate(`document.querySelector('.sl-create-v17-subject-card').click()`);
  await until(`!!document.querySelector('.sl-create-v18-row')`);
  await evaluate(`document.querySelector('.sl-create-v18-row').click()`);
  await until(`!document.querySelector('.sl-create-v18-create').disabled`);
  await delay(300);
  const screenshot=async name=>{const r=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(__dirname,name+'.png'),Buffer.from(r.data,'base64'));};
  await screenshot('create');
  const geometry=await evaluate(`Array.from(document.querySelectorAll('.v20-workspace,.sl-create-v18-board,.sl-create-v18-source,.sl-create-v18-composition')).map(e=>({class:e.className,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,scrollHeight:e.scrollHeight}))`);
  await evaluate(`document.querySelector('.sl-create-v18-create').click()`);await until(`!!document.querySelector('textarea')`);await screenshot('roster');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Xác nhận tạo lớp').click()`);
  await until(`Array.from(document.querySelectorAll('button')).some(e=>e.textContent==='Sang Xếp lịch')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Sang Xếp lịch').click()`);
  await until(`!!document.querySelector('.sl-selected-strip')`);await delay(400);await screenshot('schedule');
  // Move forward if the remaining current week has no compatible days.
  if(!await evaluate(`!!document.querySelector('.v20-add-slot')`)){await evaluate(`document.querySelector('button[aria-label="Tuần sau"]').click()`);await delay(300);}
  await until(`!!document.querySelector('.v20-add-slot:not(:disabled)')`);
  await evaluate(`document.querySelector('.v20-add-slot:not(:disabled)').click()`);
  await until(`!!document.querySelector('.v20-room')`);await screenshot('editor');
  console.log(JSON.stringify({geometry,errors,screenshots:['create','roster','schedule','editor']},null,2));
  await cmd('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();if(browser&&!browser.killed)browser.kill();server.close();});
