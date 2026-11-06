import React,{createRef} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import FloatingTableScrollbar from '../../components/FloatingTableScrollbar';

let bottom,range,frames,resize,disconnect;
beforeEach(()=>{
 bottom=1200;range=800;frames=[];disconnect=vi.fn();
 vi.stubGlobal('requestAnimationFrame',vi.fn(cb=>{frames.push(cb);return frames.length;}));
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('ResizeObserver',vi.fn(function(cb){resize=cb;return {observe:vi.fn(),disconnect};}));
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(function(){return this.dataset.testid==='scroller'||this.classList.contains('app-floating-table-scrollbar')?600:0;});
 vi.spyOn(HTMLElement.prototype,'scrollWidth','get').mockImplementation(function(){return 600+range;});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(){return {left:20,right:620,top:100,bottom,width:600,height:bottom-100};});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const flush=()=>act(()=>{const pending=frames.splice(0);pending.forEach(cb=>cb());});
function Example(){
 const wrapperRef=createRef(),tableRef=createRef();
 return <div data-testid="scroller" style={{overflowX:'auto'}}><div ref={wrapperRef}>
  <table ref={tableRef}><tbody><tr><td>Nội dung</td></tr></tbody></table>
  <FloatingTableScrollbar wrapperRef={wrapperRef} tableRef={tableRef} label="Hồ sơ trúng tuyển"/>
 </div></div>;
}
it('keeps the floating bar and original container synchronized in both directions',()=>{
 render(<Example/>);
 const bar=screen.getByRole('region',{name:'Cuộn ngang Hồ sơ trúng tuyển'}),source=screen.getByTestId('scroller');
 expect(bar.parentElement).toBe(document.body);
 expect(bar).toHaveStyle({width:'600px',left:'20px'});
 fireEvent.scroll(bar,{target:{scrollLeft:240}});expect(source.scrollLeft).toBe(240);
 fireEvent.scroll(source,{target:{scrollLeft:560}});flush();expect(bar.scrollLeft).toBe(560);
});
it('hides when the native scrollbar is visible or the table no longer overflows',()=>{
 render(<Example/>);
 expect(screen.getByRole('region')).toBeInTheDocument();
 bottom=600;fireEvent.resize(window);flush();expect(screen.queryByRole('region')).not.toBeInTheDocument();
 bottom=1200;fireEvent.resize(window);flush();expect(screen.getByRole('region')).toBeInTheDocument();
 range=0;act(()=>resize());flush();expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
it('updates the scroll range after resizing columns or changing text size and releases observers',()=>{
 const view=render(<Example/>);
 expect(screen.getByRole('region').firstChild).toHaveStyle({width:'1400px'});
 range=1200;act(()=>resize());flush();
 expect(screen.getByRole('region').firstChild).toHaveStyle({width:'1800px'});
 view.unmount();expect(disconnect).toHaveBeenCalledOnce();
});
it('supports keyboard scrolling with arrows, Home and End',()=>{
 render(<Example/>);
 const bar=screen.getByRole('region');
 fireEvent.keyDown(bar,{key:'ArrowRight'});expect(bar.scrollLeft).toBe(40);
 fireEvent.keyDown(bar,{key:'End'});expect(bar.scrollLeft).toBe(800);
 fireEvent.keyDown(bar,{key:'Home'});expect(bar.scrollLeft).toBe(0);
});
