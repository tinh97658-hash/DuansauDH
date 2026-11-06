const clean=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ');
const key=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.\s]/g,'');
const ranks={phogiaosu:'PGS',pgs:'PGS',giaosu:'GS',gs:'GS'};
const degrees={tiensi:'TS',ts:'TS',thacsi:'ThS',ths:'ThS',tiensikhoahoc:'TSKH',tskh:'TSKH',cunhan:'CN',cn:'CN',kysu:'KS',ks:'KS',bacsi:'BS',bs:'BS',bacsickii:'BS.CKII',bacsicki:'BS.CKI'};

// Legacy names may already contain a title. Display it once without editing the saved name.
export function formatLecturerName(lecturer){
 if(!lecturer)return '';
 const person=typeof lecturer==='string'?{name:lecturer}:lecturer;
 let name=clean(person.name),legacy=[];
 if(!name)return '';
 let match;
 while((match=name.match(/^(PGS|GS|TSKH|TS|ThS|CN|KS|BS(?:\.CKII?)?)(?=[.\s])\.?\s*/i))){
  const token=key(match[1]);legacy.push(ranks[token]||degrees[token]||match[1]);name=name.slice(match[0].length);
 }
 const rank=clean(person.academicRank),degree=clean(person.academicDegree);
 const titles=rank||degree?[ranks[key(rank)]||rank,degrees[key(degree)]||degree].filter(Boolean):legacy;
 const prefix=[...new Set(titles.map(title=>title.replace(/[.\s]+$/g,'')))].filter(Boolean).map(title=>`${title}.`).join(' ');
 return prefix+(prefix&&name?' ':'')+name;
}
