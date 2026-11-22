import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import React from 'react';
import createCache from '@emotion/cache';
import {CacheProvider} from '@emotion/react';
import {ThemeProvider} from '@mui/material/styles';
import {render,screen,waitFor} from '@testing-library/react';
import axios from 'axios';
import theme from '../../theme';
import ExamArrangementEditor from '../../features/exams/ExamArrangementEditor';

vi.mock('axios',()=>({default:{get:vi.fn(),defaults:{}}}));
vi.mock('../../utils/schedulingCalendar',async()=>({...await vi.importActual('../../utils/schedulingCalendar'),getBusinessTodayKey:()=> '2026-10-19',getBusinessWallTime:()=> '2026-10-19 07:00:00'}));
const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const frontendRoot=path.resolve(process.cwd(),fs.existsSync('frontend/package.json')?'frontend':'.');
const cssFiles=['node_modules/bootstrap/dist/css/bootstrap.css','src/index.css','src/styles/tables.css','src/styles/dialogs.css','src/styles/dropdowns.css','src/features/scheduling/reference.css','src/features/scheduling/workspace.css','src/components/dateField.css','src/components/timeField.css','src/features/exams/examSchedule.css','src/styles/appearance.css','src/styles/adaptive-layout.css'];
const offerings=[1,2].map(n=>({id:`o${n}`,name:`Lớp ${n}`,subjectName:n===1?'Triết học':'Xác suất thống kê',candidateCount:15,candidateIds:[`student${n}`],snapshotId:`snap${n}`,groups:[{id:`g${n}`,name:`CNTT 2026.1.${n}`}]}));

(browser?describe:describe.skip)('exam composer browser layout',()=>{
 it.each([[1,1440,100,1000],[2,1440,100,1000],[2,540,100,1000],[2,1366,150,1000],[2,1536,120,780]])('keeps %i classes usable at width %i and text scale %i',async(count,width,scale,height)=>{
  axios.get.mockResolvedValue({data:{sessions:[]}});
  const cache=createCache({key:'probe',speedy:false});
  const {unmount}=render(<CacheProvider value={cache}><ThemeProvider theme={theme}>
   <ExamArrangementEditor initial={{examDate:'2026-10-19',startTime:'08:00',endTime:'09:00',offerings:offerings.slice(0,count)}} rooms={[{id:'r1',code:'301',capacity:40},{id:'r2',code:'302',capacity:30},...Array.from({length:24},(_,i)=>({id:`demo${i}`,code:`DEMO-THI-P${i+1}`,capacity:i%3?24:40}))]} canWrite onSave={()=>{}} onClose={()=>{}}/>
  </ThemeProvider></CacheProvider>);
  await waitFor(()=>expect(screen.getByRole('button',{name:/301 40 chỗ TRỐNG/})).toBeEnabled());
  const markup=document.querySelector('.MuiDialog-root').outerHTML;
  const css=cssFiles.map(p=>fs.readFileSync(path.join(frontendRoot,p),'utf8')).join('\n')+'\n'+cache.sheet.tags.map(t=>t.textContent).join('\n');
  unmount();
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'exam-composer-'));
  const file=path.join(folder,'preview.html');
  const screenshot=process.env.EXAM_PREVIEW_DIR?path.resolve(process.env.EXAM_PREVIEW_DIR,`exam-${count}-${width}-${scale}.png`):null;
  if(screenshot)fs.mkdirSync(path.dirname(screenshot),{recursive:true});
  fs.writeFileSync(file,`<!doctype html><html lang="vi" data-font-size="${scale}" style="--app-text-scale:${scale/100}"><meta charset="utf-8"><style>${css}\n#checks{display:none}</style><body>${markup}<script>
   const bounds=e=>e.getBoundingClientRect(),dialog=document.querySelector('.v20-dialog'),main=document.querySelector('.ep-composer-main'),room=document.querySelector('.ep-room-panel'),grid=document.querySelector('.ep-composer-grid');
   const list=document.querySelector('.ep-room-list'),sidebar=document.querySelector('.ep-composer-sidebar'),row=document.querySelector('.ep-round-table tbody tr'),footer=document.querySelector('.v20-dialog-foot');
   const result={contained:bounds(dialog).left>=0&&bounds(dialog).right<=innerWidth,noBodyOverflow:document.documentElement.scrollWidth<=innerWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,noOverlap:bounds(room).left>=bounds(main).right-1||bounds(room).top>=bounds(main).bottom-1,roomCards:[...document.querySelectorAll('.ep-room-card')].every(e=>bounds(e).right<=bounds(room).right),timeControlsInline:[...document.querySelectorAll('.app-time-field')].every(e=>bounds(e.querySelector('button')).left>=bounds(e.querySelector('input')).right-1&&bounds(e).height>=32),roomsScroll:list.scrollHeight>list.clientHeight&&getComputedStyle(list).overflowY==='auto',balanced:innerWidth<=1050||bounds(sidebar).width/bounds(grid).width>=.36,classesVisible:innerWidth<=1050||bounds(row).bottom<=bounds(footer).top};
   document.body.insertAdjacentHTML('beforeend','<pre id="checks">'+JSON.stringify(result)+'</pre>');
  </script></body></html>`,'utf8');
  try{
   const args=['--headless','--disable-gpu','--no-sandbox','--hide-scrollbars',`--window-size=${width},${height}`,'--dump-dom',...(screenshot?[`--screenshot=${screenshot}`]:[]),pathToFileURL(file).href];
   const dom=execFileSync(browser,args,{encoding:'utf8',windowsHide:true,timeout:30000,stdio:['ignore','pipe','ignore']});
   const checks=JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
   expect(checks).toMatchObject({contained:true,noBodyOverflow:true,noOverlap:true,roomCards:true,timeControlsInline:true,roomsScroll:true,balanced:true,classesVisible:true,columns:width<=1050?1:2});
  }finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
 },40000);
});
