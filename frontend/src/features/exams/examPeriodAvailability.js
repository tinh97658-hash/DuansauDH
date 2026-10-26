import {useEffect,useState} from 'react';
import {addDays,formatDateKey,getBusinessWallTime} from '../../utils/schedulingCalendar';

export const isExamPeriodClosed=(date,period,wallTime=getBusinessWallTime())=>{
 if(!date)return false;
 const cutoff=period==='AFTERNOON'?'14:01:00':'08:01:00';
 return `${date} ${cutoff}`<=wallTime;
};
export const nextExamSlot=(wallTime=getBusinessWallTime())=>{
 const today=wallTime.slice(0,10);
 if(!isExamPeriodClosed(today,'MORNING',wallTime))return {examDate:today,startTime:'08:00',endTime:'09:00'};
 if(!isExamPeriodClosed(today,'AFTERNOON',wallTime))return {examDate:today,startTime:'14:00',endTime:'15:00'};
 return {examDate:formatDateKey(addDays(today,1)),startTime:'08:00',endTime:'09:00'};
};
export function useExamWallTime(){
 const [wallTime,setWallTime]=useState(()=>getBusinessWallTime());
 useEffect(()=>{
  const refresh=()=>setWallTime(getBusinessWallTime()),timer=setInterval(refresh,1000);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 return wallTime;
}
