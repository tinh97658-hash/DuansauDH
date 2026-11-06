import {formatLecturerName} from '../../utils/lecturerName';
import React,{useState} from 'react';
import {normalize} from '../scheduling/shared';
import ExamResourceInput from './ExamResourceInput';
import {examInvigilatorBusy} from './examInvigilators';

export default function SecondExamInvigilator({form,onChange,lecturers,units,busy,disabled}){
 const initialLecturer=lecturers.find(l=>l.id===form.secondLecturerId);
 const [unitText,setUnitText]=useState(()=>form.secondExternalUnitName||units.find(u=>u.id===initialLecturer?.unitId)?.name||'');
 const unit=units.find(u=>normalize(u.name).trim()===normalize(unitText).trim());
 const options=lecturers.filter(l=>unit?.id&&l.unitId===unit.id&&(l.active||l.id===form.secondLecturerId));
 const name=formatLecturerName(lecturers.find(l=>l.id===form.secondLecturerId))||form.secondExternalInvigilatorName||'';
 const changeUnit=value=>{setUnitText(value);onChange({secondLecturerId:'',secondExternalInvigilatorName:'',secondExternalUnitName:value});};
 const changeName=value=>{const lecturer=options.find(l=>(normalize(l.name).trim()===normalize(value).trim()||normalize(formatLecturerName(l)).trim()===normalize(value).trim()));onChange({secondLecturerId:lecturer?.id||'',secondExternalInvigilatorName:lecturer?'':value,secondExternalUnitName:lecturer?'':unitText});};
 return <>
  <label className="v20-field">Đơn vị cán bộ 2<ExamResourceInput label="Đơn vị cán bộ 2" value={unitText} options={units} placeholder="Chọn hoặc nhập đơn vị" disabled={disabled} onChange={changeUnit} onSelect={u=>changeUnit(u.name)}/></label>
  <label className="v20-field">Cán bộ coi thi 2<ExamResourceInput label="Cán bộ coi thi 2" value={name} getOptionLabel={formatLecturerName} options={options.map(l=>({...l,disabled:l.id===form.lecturerId||examInvigilatorBusy({id:l.id},busy)}))} placeholder="Chọn hoặc nhập tên cán bộ coi thi" disabled={disabled||!unitText.trim()} onChange={changeName} onSelect={l=>changeName(l.name)}/></label>
 </>;
}
