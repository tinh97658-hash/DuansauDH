import React,{useEffect,useRef,useState} from 'react';
import axios from 'axios';
import {useSearchParams} from 'react-router-dom';
import {Alert,Box,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,MenuItem,Paper,Stack,Table,TableBody,TableCell,TableHead,TableRow,TextField,Typography} from '@mui/material';
import FeatureLayout from '../../components/FeatureLayout';
import {API_BASE_URL} from '../../config/http';
import {usePermissions} from '../accounts/usePermissions';
import {AuthSessionContext,useAuthSession} from '../../context/AuthSession';

const root=`${API_BASE_URL}/learner-codes`;
export default function LearnerCodeIssue({embedded=false,onBusyChange}){
  const session=useAuthSession();
  // The embedded panel retains the existing code-specific route action grants.
  return <AuthSessionContext.Provider value={embedded?{...session,currentPath:'/plan/learner-codes'}:session}>
    <IssueContent key={`${session?.user?.id}:${session?.activeProfile?.id}`} embedded={embedded} onBusyChange={onBusyChange}/>
  </AuthSessionContext.Provider>;
}
const EmbeddedLayout=({children})=><>{children}</>;
function IssueContent({embedded,onBusyChange}){
  const {can}=usePermissions(),[params]=useSearchParams();
  const [options,setOptions]=useState({types:[],groups:[]}),[group,setGroup]=useState(params.get('classGroupId')||''),[records,setRecords]=useState([]),[selected,setSelected]=useState([]);
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[order,setOrder]=useState('name'),[manual,setManual]=useState(''),[edit,setEdit]=useState(null),[history,setHistory]=useState(null);
  const requestId=useRef(null),generation=useRef(0);
  const Layout=embedded?EmbeddedLayout:FeatureLayout;
  useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
  const one=records.find(r=>r.id===selected[0]);
  const clear=()=>{setPreview(null);requestId.current=null;};
  useEffect(()=>{const c=new AbortController();axios.get(`${root}/options`,{signal:c.signal,params:{recordId:params.get('recordId')||undefined}}).then(({data})=>{
    setOptions(data);
    if(!group&&data.requestedRecord&&!data.defaultGroupId){setRecords([data.requestedRecord]);setSelected([data.requestedRecord.id]);}
    else if(!group&&data.groups.length)setGroup(data.defaultGroupId||data.groups[0].id);
  }).catch(e=>{if(e.code!=='ERR_CANCELED')setError(e.response?.data?.message||'Không thể tải danh sách lớp.');});return()=>c.abort();},[]);
  const load=async(refreshId)=>{
    if(!group){
      const recordId=refreshId||options.requestedRecord?.id||params.get('recordId');
      if(!recordId)return;
      const current=++generation.current;
      try{
        const {data}=await axios.get(`${root}/records/${recordId}`);
        if(current!==generation.current)return;
        setOptions(previous=>({...previous,requestedRecord:data}));setRecords([data]);setSelected([data.id]);
      }catch(e){if(current===generation.current){setRecords([]);setSelected([]);setOptions(previous=>({...previous,requestedRecord:undefined}));setError(e.response?.data?.message||'Đã lưu nhưng chưa tải lại được hồ sơ. Vui lòng tải lại trang.');}}
      return;
    }
    const current=++generation.current;
    try{const {data}=await axios.get(`${root}/class/${group}/records`);if(current!==generation.current)return;setRecords(data);setSelected(data.some(r=>r.id===params.get('recordId'))?[params.get('recordId')]:[]);}
    catch(e){if(current===generation.current)setError(e.response?.data?.message||'Không thể tải hồ sơ.');}
  };
  useEffect(()=>{setRecords([]);setSelected([]);clear();
    if(!group&&options.requestedRecord){setRecords([options.requestedRecord]);setSelected([options.requestedRecord.id]);}else load();
    return()=>{generation.current++;};},[group]);
  const input=()=>({classGroupId:group,recordIds:selected,order,manual:manual||undefined});
  const run=async work=>{setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError(e.response?.data?.message||'Không thể thực hiện.');if(e.response?.status===409)clear();}finally{setBusy(false);}};
  const showPreview=()=>run(async()=>{
    const {data}=await axios.get(`${root}/preview`,{params:{...input(),recordIds:selected.join(',')}});setPreview(data);requestId.current=crypto.randomUUID();
  });
  const issue=()=>run(async()=>{
    await axios.post(`${root}/issue`,{...input(),fingerprint:preview.fingerprint,requestId:requestId.current});
    clear();setMessage('Đã cấp mã. Các bộ đếm được cập nhật riêng theo từng loại hồ sơ.');await load();
  });
  const showRecordAction=kind=>run(async()=>{
    const {data}=await axios.get(`${root}/records/${one.id}`);
    setEdit({kind,...data,typeId:data.learner_code_type_id||'',reason:'',newCode:'',requestId:crypto.randomUUID()});
  });
  const saveAction=()=>run(async()=>{
    const savedId=edit.id;
    if(edit.kind==='type')await axios.put(`${root}/records/${edit.id}/type`,{typeId:edit.typeId,reason:edit.reason});
    else await axios.post(`${root}/records/${edit.id}/reissue`,{code:edit.newCode.toUpperCase().trim(),reason:edit.reason,fingerprint:edit.fingerprint,requestId:edit.requestId});
    setEdit(null);clear();setMessage('Đã cập nhật và ghi lịch sử.');await load(savedId);
  });
  const toggle=id=>{clear();setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);};
  return <Layout title="Cấp mã học viên" group="Thủ tục đầu vào" desc="Cấp mã học viên chính thức sau khi xác nhận trúng tuyển; xem trước theo tên với bộ đếm riêng cho từng loại hồ sơ.">
    {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{message&&<Alert severity="success" sx={{mb:2}}>{message}</Alert>}
    <Paper variant="outlined" sx={{p:2,mb:2}}><Stack gap={2}>
      <TextField select label="Lớp hành chính" value={group} disabled={busy} onChange={e=>setGroup(e.target.value)} size="small">
        {options.requestedRecord&&!options.defaultGroupId&&<MenuItem value="">Hồ sơ chưa có một lớp hành chính chính phù hợp</MenuItem>}
        {options.groups.map(g=><MenuItem key={g.id} value={g.id}>{g.code} · {g.name} · {g.academic_year}</MenuItem>)}</TextField>
      <Stack direction="row" gap={2} flexWrap="wrap"><TextField select size="small" label="Thứ tự cấp" value={order} disabled={busy} onChange={e=>{setOrder(e.target.value);clear();}} sx={{minWidth:220}}>
        <MenuItem value="name">Theo tên A–Z, sau đó họ đệm</MenuItem><MenuItem value="selected">Theo thứ tự chọn hồ sơ</MenuItem></TextField>
        <TextField size="small" label="Phần nhập tay (nếu mẫu yêu cầu)" value={manual} disabled={busy} onChange={e=>{setManual(e.target.value.toUpperCase());clear();}}/>
        {can('learnercode.preview')&&<Button disabled={busy||!group||!selected.length||selected.length>100} variant="outlined" onClick={showPreview}>Xem trước {selected.length} hồ sơ</Button>}
      </Stack>
      <Alert severity="info">Hồ sơ bình thường được nhận diện theo phân loại hồ sơ và cần xác nhận trúng tuyển trước khi cấp mã. Loại đặc biệt cần được gán riêng. Hồ sơ cũ giữ nguyên mã cho đến khi bạn chủ động cấp mã chính thức. Mỗi lô tối đa 100 hồ sơ.</Alert>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {selected.length===1&&((one?.learner_code_state==='official'&&can('learnercode.type.change'))||(one?.learner_code_state!=='official'&&can('learnercode.type.assign')))&&<Button disabled={busy} onClick={()=>showRecordAction('type')}>Gán/đổi loại hồ sơ</Button>}
        {selected.length===1&&one?.learner_code_state==='official'&&can('learnercode.reissue')&&<Button disabled={busy} onClick={()=>showRecordAction('reissue')}>Đổi mã đã cấp</Button>}
        {selected.length===1&&can('learnercode.history.view')&&<Button disabled={busy} onClick={()=>run(async()=>setHistory((await axios.get(`${root}/records/${one.id}/history`)).data))}>Lịch sử mã</Button>}
      </Stack>
    </Stack></Paper>
    <Paper variant="outlined" sx={{overflowX:'auto'}}><Table size="small"><TableHead><TableRow>
      <TableCell><Checkbox inputProps={{'aria-label':'Chọn hồ sơ chưa có mã chính thức'}} disabled={busy} checked={!!records.length&&records.filter(r=>r.learner_code_state!=='official').length>0&&records.filter(r=>r.learner_code_state!=='official').every(r=>selected.includes(r.id))}
        onChange={e=>{clear();setSelected(e.target.checked?records.filter(r=>r.learner_code_state!=='official').slice(0,100).map(r=>r.id):[]);}}/></TableCell>
      {['Mã hiện tại','Họ tên','Phân loại hiện có','Loại hồ sơ để cấp mã','Trạng thái mã'].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
      {records.map(r=><TableRow key={r.id} selected={selected.includes(r.id)}><TableCell><Checkbox inputProps={{'aria-label':`Chọn ${r.full_name}`}} disabled={busy} checked={selected.includes(r.id)} onChange={()=>toggle(r.id)}/></TableCell><TableCell>{r.code}</TableCell><TableCell>{r.full_name}</TableCell><TableCell>{r.profile_category||'—'}</TableCell><TableCell>{r.type_name||'Chưa phân loại'}</TableCell><TableCell>{{legacy:'Mã cũ — chưa đối soát',provisional:'Mã tiếp nhận',official:'Chính thức'}[r.learner_code_state]}</TableCell></TableRow>)}
      {!records.length&&<TableRow><TableCell colSpan={6}>Chưa có hồ sơ trong lớp được chọn.</TableCell></TableRow>}
    </TableBody></Table></Paper>
    <Dialog open={!!preview} fullWidth maxWidth="md" onClose={()=>!busy&&clear()}><DialogTitle>Xem trước cấp mã</DialogTitle><DialogContent>
      <Alert severity="info">Bản xem trước chưa giữ chỗ mã. Hệ thống kiểm tra lại trước khi xác nhận; mã của các học viên khác được giữ nguyên.</Alert>
      <Table size="small"><TableHead><TableRow>{['STT','Họ tên','Loại','Mã cũ','Mã chính thức dự kiến'].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
        {preview?.rows.map((r,i)=><TableRow key={r.id}><TableCell>{i+1}</TableCell><TableCell>{r.fullName}</TableCell><TableCell>{r.typeName}</TableCell><TableCell>{r.oldCode}</TableCell><TableCell><strong>{r.code}</strong><Typography variant="caption" display="block">{r.components.join(' + ')}</Typography></TableCell></TableRow>)}
      </TableBody></Table>
    </DialogContent><DialogActions><Button disabled={busy} onClick={clear}>Đóng</Button>{can('learnercode.issue')&&<Button disabled={busy} variant="contained" onClick={issue}>Xác nhận cấp mã</Button>}</DialogActions></Dialog>
    <Dialog open={!!edit} fullWidth onClose={()=>!busy&&setEdit(null)}><DialogTitle>{edit?.kind==='type'?'Gán/đổi loại hồ sơ':'Xem trước đổi mã chính thức'}</DialogTitle><DialogContent><Stack gap={2} sx={{pt:1}}>
      {error&&<Alert severity="error">{error}</Alert>}<Typography>Mã hiện tại: {edit?.code}</Typography>
      {edit?.kind==='type'?<><TextField select label="Loại hồ sơ" value={edit.typeId} onChange={e=>setEdit({...edit,typeId:e.target.value})}>{options.types.filter(t=>t.active).map(t=><MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField><Alert severity="info">Đổi loại giữ nguyên mã đã cấp. Nếu cần đổi mã, thực hiện thao tác Đổi mã riêng.</Alert></>
        :<><Typography>Mã tiếp nhận gốc: {edit?.intake_code||'—'}</Typography><TextField label="Mã mới dự kiến" value={edit?.newCode||''} onChange={e=>setEdit({...edit,newCode:e.target.value.toUpperCase()})}/><Alert severity="warning">Mã cũ được giữ chỗ vĩnh viễn. Kiểm tra tài liệu đã phát hành trước khi xác nhận.</Alert></>}
      <TextField label="Lý do bắt buộc" multiline value={edit?.reason||''} onChange={e=>setEdit({...edit,reason:e.target.value})}/>
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={()=>setEdit(null)}>Hủy</Button><Button disabled={busy||!edit?.reason?.trim()||(edit?.kind==='reissue'&&!edit?.newCode?.trim())} variant="contained" onClick={saveAction}>Xác nhận</Button></DialogActions></Dialog>
    <Dialog open={history!==null} fullWidth maxWidth="md" onClose={()=>setHistory(null)}><DialogTitle>Lịch sử mã học viên</DialogTitle><DialogContent>
      {!history?.length&&<Typography>Chưa có lịch sử cấp mã.</Typography>}{history?.map(h=><Box key={h.id} sx={{py:1,borderBottom:1,borderColor:'divider'}}><Typography>{new Date(h.created_at).toLocaleString('vi-VN')} · {{issue:'Cấp mã',reissue:'Đổi mã','type.assign':'Gán/đổi loại'}[h.action]||h.action}</Typography>
        <Typography>Mã: {h.before_data?.code||'—'} → {h.after_data?.code||h.before_data?.code||'—'}</Typography><Typography>{h.actor_name} · {h.profile_name}</Typography><Typography>{h.reason||''}</Typography></Box>)}
    </DialogContent><DialogActions><Button onClick={()=>setHistory(null)}>Đóng</Button></DialogActions></Dialog>
  </Layout>;
}
