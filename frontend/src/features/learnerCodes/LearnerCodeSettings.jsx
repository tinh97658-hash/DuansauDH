import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import FeatureLayout from '../../components/FeatureLayout';
import { API_BASE_URL } from '../../config/http';
import { usePermissions } from '../accounts/usePermissions';
import { useAuthSession } from '../../context/AuthSession';

const root=`${API_BASE_URL}/learner-codes`;
const defaults=[{kind:'major'},{kind:'year',width:2},{kind:'round',width:1},{kind:'group',width:1},{kind:'sequence',width:3}];
const kinds={major:'Viết tắt chuyên ngành',year:'Năm',round:'Đợt',group:'Thứ tự lớp',sequence:'Số tự tăng và chữ loại',literal:'Giá trị cố định',manual:'Giá trị nhập tay'};
const scopes={class:'Theo lớp và loại hồ sơ',major_round:'Theo chuyên ngành, năm, đợt và loại',major_year:'Theo chuyên ngành, năm và loại',year:'Theo năm và loại',global:'Theo bậc và loại hồ sơ'};
export default function LearnerCodeSettings(){
  const session=useAuthSession();
  return <SettingsContent key={`${session?.user?.id}:${session?.activeProfile?.id}`}/>;
}
function SettingsContent(){
  const {can,access}=usePermissions(),[data,setData]=useState({types:[],rules:[],abbreviations:[],majors:[],groups:[]}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[edit,setEdit]=useState(null),[counters,setCounters]=useState([]);
  const globalWrite=!access?.groupScope?.readOnly&&!access?.groupScope?.restrictEdit;
  const load=async()=>{try{setData((await axios.get(`${root}/config`)).data);setError('');}catch(e){setError(e.response?.data?.message||'Không thể tải cấu hình.');}};
  useEffect(()=>{load();},[]);
  const save=async()=>{
    setBusy(true);setError('');try{
      const {kind,id,...form}=edit;
      if(kind==='type')await axios({method:id?'put':'post',url:`${root}/types${id?`/${id}`:''}`,data:{...form,letter:form.letter||undefined}});
      if(kind==='abbreviation')await axios.put(`${root}/abbreviations/${form.majorId}`,{abbreviation:form.abbreviation});
      if(kind==='rule')await axios({method:id?'put':'post',url:`${root}/rules${id?`/${id}`:''}`,data:form});
      if(kind==='counter')await axios.post(`${root}/counters/advance`,{key:form.key,nextNumber:form.nextNumber,reason:form.reason});
      setEdit(null);await load();
    }catch(e){setError(e.response?.data?.message||'Không thể lưu.');}finally{setBusy(false);}
  };
  const field=(key,label,options)=> <TextField fullWidth size="small" label={label} disabled={key==='counterScope'&&!!edit.id} value={edit[key]??''} onChange={e=>setEdit({...edit,[key]:e.target.value||undefined})} select={!!options}>
    {options&&[<MenuItem value="" key="">Không giới hạn</MenuItem>,...options.map(o=><MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)]}</TextField>;
  const openRule=r=>setEdit({kind:'rule',id:r.id,name:r.name,active:r.active,program:r.program||undefined,majorId:r.major_id||undefined,academicYear:r.academic_year||undefined,
    intakeRound:r.intake_round||undefined,classGroupId:r.class_group_id||undefined,typeId:r.type_id||undefined,counterScope:r.counter_scope,startNumber:Number(r.start_number),parts:r.parts,version:r.version,effectiveFrom:r.effective_from});
  return <FeatureLayout title="Quy tắc mã học viên" group="Hệ thống" desc="Cấu hình chữ cái, mẫu mã và bộ đếm độc lập cho từng loại hồ sơ.">
    {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    {!globalWrite&&<Alert severity="info">Cấu hình dùng chung chỉ được sửa với hồ sơ có phạm vi sửa toàn viện.</Alert>}
    <Paper variant="outlined" sx={{p:2,mb:2}}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Loại hồ sơ</Typography>
      {can('learnercode.config.manage')&&globalWrite&&<Button onClick={()=>setEdit({kind:'type',name:'',key:'',letter:'',active:false,requiresAdmission:true})}>Thêm loại</Button>}</Stack>
      <Table size="small"><TableHead><TableRow>{['Tên loại','Chữ cái','Điều kiện','Trạng thái',''].map((h,i)=><TableCell key={i}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
        {data.types.map(t=><TableRow key={t.id}><TableCell>{t.name}</TableCell><TableCell>{t.letter||'—'}</TableCell><TableCell>{t.requires_admission?'Đã trúng tuyển':'Theo danh sách lớp đã tiếp nhận'}</TableCell><TableCell>{t.active?'Đang dùng':'Chưa kích hoạt'}</TableCell>
          <TableCell>{can('learnercode.config.manage')&&globalWrite&&<Button onClick={()=>setEdit({kind:'type',id:t.id,key:t.key,name:t.name,letter:t.letter||undefined,active:t.active,requiresAdmission:t.requires_admission,version:t.version})}>Sửa</Button>}</TableCell></TableRow>)}
      </TableBody></Table>
    </Paper>
    <Paper variant="outlined" sx={{p:2,mb:2}}><Typography variant="h6">Viết tắt chuyên ngành</Typography><Stack gap={1} sx={{mt:1}}>
      {data.majors.map(m=><Stack key={m.id} direction="row" alignItems="center" justifyContent="space-between"><Typography>{m.name} · {data.abbreviations.find(a=>a.major_id===m.id)?.abbreviation||'Chưa cấu hình'}</Typography>
        {can('learnercode.config.manage')&&globalWrite&&<Button onClick={()=>setEdit({kind:'abbreviation',majorId:m.id,abbreviation:data.abbreviations.find(a=>a.major_id===m.id)?.abbreviation||''})}>Cấu hình</Button>}</Stack>)}
    </Stack></Paper>
    <Paper variant="outlined" sx={{p:2,mb:2}}><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Mẫu và phạm vi cấp mã</Typography>
      {can('learnercode.config.manage')&&globalWrite&&<Button onClick={()=>setEdit({kind:'rule',name:'',active:false,counterScope:'class',startNumber:1,parts:defaults})}>Thêm quy tắc</Button>}</Stack>
      {data.rules.map(r=><Stack key={r.id} direction="row" gap={2} alignItems="center" sx={{py:1}}><Box flex={1}><Typography>{r.name} · Phiên bản {r.version} · {r.active?'Đang dùng':'Ngừng dùng'}</Typography>
        <Typography variant="body2">{r.parts.map(p=>kinds[p.kind]).join(' + ')} · {scopes[r.counter_scope]}</Typography></Box>
        {can('learnercode.config.manage')&&globalWrite&&<Button onClick={()=>openRule(r)}>Sửa</Button>}</Stack>)}
    </Paper>
    <Paper variant="outlined" sx={{p:2}}><Button onClick={async()=>{try{setCounters((await axios.get(`${root}/counters`)).data);}catch(e){setError(e.response?.data?.message||'Không tải được bộ đếm.');}}}>Xem bộ đếm đã dùng</Button>
      {counters.map(c=><Stack key={c.key} direction="row" gap={2} alignItems="center"><Typography>{c.type_name} · {c.group_code||scopes[JSON.parse(c.key)[0]]} · Số tiếp theo: {c.next_number}{c.maxNumber!=null?` · Giới hạn ${c.maxNumber}`:' · Chưa có quy tắc hợp lệ'}</Typography>
        {can('learnercode.counter.advance')&&globalWrite&&<Button disabled={c.maxNumber==null||Number(c.next_number)>=c.maxNumber} onClick={()=>setEdit({kind:'counter',key:c.key,nextNumber:Number(c.next_number)+1,maxNumber:c.maxNumber,reason:''})}>Tăng số tiếp theo</Button>}</Stack>)}
    </Paper>
    <Dialog open={!!edit} onClose={()=>!busy&&setEdit(null)} fullWidth maxWidth="md"><DialogTitle>{edit?.kind==='type'?'Loại hồ sơ':edit?.kind==='rule'?'Quy tắc mã học viên':edit?.kind==='counter'?'Điều chỉnh bộ đếm':'Viết tắt chuyên ngành'}</DialogTitle>
      <DialogContent><Stack gap={2} sx={{pt:1}}>{error&&<Alert severity="error">{error}</Alert>}
        {edit?.kind==='type'&&<>{field('name','Tên loại hồ sơ')}{!edit.id&&field('key','Khóa loại hồ sơ (chữ thường, số, gạch dưới)')}
          {edit.key!=='regular'&&field('letter','Chữ cái của loại hồ sơ (A–Z)')}
          <FormControlLabel control={<Checkbox disabled={edit.key==='regular'} checked={edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/>} label="Kích hoạt"/>
          <FormControlLabel control={<Checkbox disabled={edit.key==='regular'} checked={edit.requiresAdmission} onChange={e=>setEdit({...edit,requiresAdmission:e.target.checked})}/>} label="Yêu cầu xác nhận trúng tuyển trước khi cấp mã"/>
          {!edit.requiresAdmission&&<Alert severity="warning">Chỉ tắt yêu cầu trúng tuyển khi loại hồ sơ có quy trình tiếp nhận riêng. Hồ sơ vẫn phải thuộc lớp hành chính phù hợp.</Alert>}</>}
        {edit?.kind==='abbreviation'&&field('abbreviation','Viết tắt (2–12 chữ/số)')}
        {edit?.kind==='rule'&&<>{field('name','Tên quy tắc')}{field('program','Bậc đào tạo',[{id:'masters',name:'Thạc sĩ'},{id:'doctoral',name:'Tiến sĩ'}])}
          <TextField label="Hiệu lực từ" type="date" InputLabelProps={{shrink:true}} value={edit.effectiveFrom||''} onChange={e=>setEdit({...edit,effectiveFrom:e.target.value||undefined})}/>
          {field('majorId','Chuyên ngành',data.majors)}{field('academicYear','Năm (4 số, bỏ trống nếu không giới hạn)')}
          <TextField label="Đợt (bỏ trống nếu không giới hạn)" type="number" value={edit.intakeRound||''} onChange={e=>setEdit({...edit,intakeRound:e.target.value?Number(e.target.value):undefined})}/>
          {field('typeId','Loại hồ sơ',data.types)}{field('classGroupId','Lớp áp dụng riêng',data.groups.map(g=>({id:g.id,name:`${g.code} · ${g.name}`})))}
          {field('counterScope','Phạm vi bộ đếm',Object.entries(scopes).map(([id,name])=>({id,name})))}
          <TextField label="Số bắt đầu" type="number" value={edit.startNumber} onChange={e=>setEdit({...edit,startNumber:Number(e.target.value)})}/>
          <Typography>Các thành phần theo thứ tự ghép mã</Typography>
          {edit.parts.map((p,i)=><Stack key={i} direction="row" gap={1} alignItems="center"><TextField select size="small" label="Thành phần" value={p.kind} onChange={e=>setEdit({...edit,parts:edit.parts.map((x,j)=>j===i?{kind:e.target.value,width:e.target.value==='year'?2:['sequence','manual'].includes(e.target.value)?3:1}:x)})} sx={{minWidth:210}}>
            {Object.entries(kinds).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
            {!['major','literal'].includes(p.kind)&&<TextField label="Độ dài" type="number" size="small" value={p.width||1} onChange={e=>setEdit({...edit,parts:edit.parts.map((x,j)=>j===i?{...x,width:Number(e.target.value)}:x)})}/>}
            {p.kind==='literal'&&<TextField label="Chữ/số hoặc dấu phân cách" size="small" value={p.value||''} onChange={e=>setEdit({...edit,parts:edit.parts.map((x,j)=>j===i?{...x,value:e.target.value.toUpperCase()}:x)})}/>}
            <Button disabled={!i} onClick={()=>{const parts=[...edit.parts];[parts[i-1],parts[i]]=[parts[i],parts[i-1]];setEdit({...edit,parts});}}>Lên</Button>
            <Button onClick={()=>setEdit({...edit,parts:edit.parts.filter((_,j)=>j!==i)})}>Bỏ</Button></Stack>)}
          <Button onClick={()=>setEdit({...edit,parts:[...edit.parts,{kind:'literal',value:'-'}]})}>Thêm thành phần</Button>
          <FormControlLabel control={<Checkbox checked={edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/>} label="Áp dụng quy tắc"/>
          <Alert severity="info">Loại đặc biệt dùng một ký tự cuối cho chữ cái: đuôi dài 3 ký tự gồm 2 số và 1 chữ. Thay quy tắc không đổi mã đã cấp.</Alert></>}
        {edit?.kind==='counter'&&<><TextField label="Số tiếp theo" type="number" inputProps={{min:1,max:edit.maxNumber}} helperText={`Giới hạn theo quy tắc hiện tại: ${edit.maxNumber}`} value={edit.nextNumber} onChange={e=>setEdit({...edit,nextNumber:Number(e.target.value)})}/>{field('reason','Lý do tăng bộ đếm')}</>}
      </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={()=>setEdit(null)}>Hủy</Button><Button disabled={busy} variant="contained" onClick={save}>Lưu</Button></DialogActions>
    </Dialog>
  </FeatureLayout>;
}
