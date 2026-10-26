import React,{useEffect,useId,useRef,useState} from 'react';
import {normalize} from '../scheduling/shared';

export default function ExamResourceInput({label,value,options,onChange,onSelect,disabled,placeholder}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),ref=useRef(null),id=useId();
 useEffect(()=>{const close=e=>{if(!ref.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const visible=options.filter(o=>normalize(o.name).includes(normalize(query)));
 return <div className="sl-combo ep-resource-input" ref={ref} onKeyDown={e=>{
  if(e.key==='Escape')setOpen(false);
  if(['ArrowDown','ArrowUp'].includes(e.key)){
   e.preventDefault();setOpen(true);
   const items=[...ref.current.querySelectorAll('[role="option"]:not(:disabled)')],current=items.indexOf(document.activeElement);
   items[e.key==='ArrowDown'?(current+1)%items.length:(current<=0?items.length-1:current-1)]?.focus();
  }
 }}>
  <input aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id} autoComplete="off" maxLength={255} value={value} disabled={disabled} placeholder={placeholder} onFocus={()=>{setQuery('');setOpen(true);}} onChange={e=>{onChange(e.target.value);setQuery(e.target.value);setOpen(true);}}/>
  <button type="button" aria-label={`Mở ${label}`} aria-expanded={open} disabled={disabled} onClick={()=>{setQuery('');setOpen(v=>!v);}}/>
  {open&&<div id={id} role="listbox" aria-label={label} className="sl-combo-list sl-show">
   {visible.map(o=><button type="button" key={o.id} role="option" aria-selected={o.name===value} disabled={o.disabled} onClick={()=>{onSelect(o);setOpen(false);}}>{o.name}{o.disabled&&<small>Đang bận</small>}</button>)}
   {!visible.length&&<p className="ep-resource-hint">Gõ tên để sử dụng thông tin bên ngoài.</p>}
  </div>}
 </div>;
}
