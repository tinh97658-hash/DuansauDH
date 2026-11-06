import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

const clips=value=>/auto|scroll|hidden|clip/.test(value);

export default function FloatingTableScrollbar({wrapperRef,tableRef,label}) {
  const barRef=useRef(null),scrollerRef=useRef(null);
  const [geometry,setGeometry]=useState(null);
  useEffect(()=>{
    const table=tableRef.current;
    let scroller=wrapperRef.current?.parentElement;
    while(scroller&&scroller!==document.body&&!/auto|scroll/.test(getComputedStyle(scroller).overflowX))scroller=scroller.parentElement;
    if(!table||!scroller||scroller===document.body)return undefined;
    scrollerRef.current=scroller;
    const hadScrollbarClass=scroller.classList.contains('app-table-scrollbar');
    scroller.classList.add('app-table-scrollbar');
    let frame;
    const measure=()=>{
      frame=undefined;
      const rect=scroller.getBoundingClientRect();
      let left=Math.max(0,rect.left+scroller.clientLeft),right=Math.min(document.documentElement.clientWidth||window.innerWidth,rect.left+scroller.clientLeft+scroller.clientWidth);
      let top=Math.max(0,rect.top),bottom=Math.min(window.innerHeight,rect.bottom);
      for(let parent=scroller.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
        const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
        if(clips(style.overflowX)){left=Math.max(left,bounds.left+parent.clientLeft);right=Math.min(right,bounds.left+parent.clientLeft+parent.clientWidth);}
        if(clips(style.overflowY)){top=Math.max(top,bounds.top+parent.clientTop);bottom=Math.min(bottom,bounds.top+parent.clientTop+parent.clientHeight);}
      }
      const range=scroller.scrollWidth-scroller.clientWidth,width=Math.floor(right-left);
      const next=range>1&&width>40&&bottom-top>48&&rect.bottom>bottom+2
        ?{left:Math.round(left),top:Math.floor(bottom-12),width,contentWidth:width+range,zIndex:scroller.closest('.MuiDialog-root')?1400:1050}:null;
      setGeometry(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
      if(barRef.current&&barRef.current.scrollLeft!==scroller.scrollLeft)barRef.current.scrollLeft=scroller.scrollLeft;
    };
    const schedule=()=>{if(frame===undefined)frame=requestAnimationFrame(measure);};
    measure();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
    observer?.observe(scroller);observer?.observe(table);
    window.addEventListener('resize',schedule);
    document.addEventListener('scroll',schedule,true);
    window.visualViewport?.addEventListener('resize',schedule);
    return()=>{
      if(frame!==undefined)cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize',schedule);
      document.removeEventListener('scroll',schedule,true);
      window.visualViewport?.removeEventListener('resize',schedule);
      if(!hadScrollbarClass)scroller.classList.remove('app-table-scrollbar');
      scrollerRef.current=null;
    };
  },[wrapperRef,tableRef]);
  useEffect(()=>{if(barRef.current&&scrollerRef.current)barRef.current.scrollLeft=scrollerRef.current.scrollLeft;},[geometry]);
  if(!geometry)return null;
  return createPortal(<div ref={barRef} className="app-floating-table-scrollbar" role="region" tabIndex={0}
    aria-label={`Cuộn ngang ${label||'bảng dữ liệu'}`} title="Kéo để cuộn ngang bảng" style={{left:geometry.left,top:geometry.top,width:geometry.width,zIndex:geometry.zIndex}}
    onScroll={event=>{if(scrollerRef.current)scrollerRef.current.scrollLeft=event.currentTarget.scrollLeft;}}
    onKeyDown={event=>{
      const bar=event.currentTarget,range=bar.scrollWidth-bar.clientWidth;
      const offsets={ArrowLeft:-40,ArrowRight:40,PageUp:-bar.clientWidth,PageDown:bar.clientWidth};
      if(event.key in offsets){event.preventDefault();bar.scrollLeft+=offsets[event.key];}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();bar.scrollLeft=event.key==='Home'?0:range;}
    }}><div aria-hidden="true" style={{width:geometry.contentWidth,height:1}}/></div>,document.body);
}
