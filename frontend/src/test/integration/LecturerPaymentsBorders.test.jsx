import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
(browser?it:it.skip)('keeps every class divider for 1–10 participating classes, including the last row',()=>{
  const folder=path.resolve('../.tmp/payment-borders');fs.mkdirSync(folder,{recursive:true});
  const css=['src/index.css','src/styles/tables.css','src/pages/masters/classCourseHistory.css','src/pages/reports/lecturerPayments.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
  const tables=Array.from({length:10},(_,i)=>{
    const count=i+1;
    const rows=Array.from({length:count},(_,j)=>j===0?`<tr><td rowspan="${count}">1</td><td rowspan="${count}">Giảng viên</td><td rowspan="${count}">Học phần</td><td class="lp-participating-cell">Lớp 1</td>${Array.from({length:5},()=>`<td rowspan="${count}">Dữ liệu</td>`).join('')}</tr>`:`<tr class="lp-group-row"><td class="lp-participating-cell">Lớp ${j+1}</td></tr>`).join('');
    return `<table class="tp-table lp-table"><tbody>${rows}</tbody></table>`;
  }).join('');
  const html=path.join(folder,'preview.html');
  fs.writeFileSync(html,`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"><div class="tp-page lp-page">${tables}</div></div><script>
    const checks=[...document.querySelectorAll('.lp-table')].map(table=>{
      const cells=[...table.querySelectorAll('.lp-participating-cell')],first=cells[0].getBoundingClientRect();
      return cells.map(cell=>{const c=getComputedStyle(cell),r=cell.getBoundingClientRect();return {right:c.borderRightWidth,bottom:c.borderBottomWidth,rightColor:c.borderRightColor,bottomColor:c.borderBottomColor,leftAligned:Math.abs(r.left-first.left)<1,rightAligned:Math.abs(r.right-first.right)<1}});
    });document.body.insertAdjacentHTML('beforeend','<pre id="checks">'+JSON.stringify(checks)+'</pre>');
  </script>`);
  const dom=execFileSync(browser,['--headless','--disable-gpu','--no-sandbox','--disable-background-networking',`--user-data-dir=${path.join(folder,'chrome')}`,'--dump-dom',`file:///${html.replaceAll('\\','/')}`],{encoding:'utf8',windowsHide:true,timeout:30000,stdio:['ignore','pipe','ignore']});
  const checks=JSON.parse([...dom.matchAll(/<pre id="checks">(.*?)<\/pre>/gs)].at(-1)[1]);
  expect(checks).toHaveLength(10);
  checks.forEach((rows,i)=>{expect(rows).toHaveLength(i+1);for(const row of rows)expect(row).toEqual({right:'1px',bottom:'1px',rightColor:'rgb(0, 0, 0)',bottomColor:'rgb(0, 0, 0)',leftAligned:true,rightAligned:true});});
},45000);
