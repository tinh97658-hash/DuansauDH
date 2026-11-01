import React from 'react';

export default function ExamLearnerClasses({groups=[]}){
 const labels=(groups||[]).map(group=>group.code||group.name).filter(Boolean);
 const lines=[];
 for(let index=0;index<labels.length;index+=2)lines.push(labels.slice(index,index+2));
 return <span className="ep-learner-classes">{lines.length?lines.map((line,index)=><span className="ep-learner-class-line" key={index}>{index?' + ':''}{line.join(' + ')}</span>):'—'}</span>;
}
