import React from 'react';
import {Modal} from '../scheduling/shared';

// Existing forms can be displayed inside the shared detail dialog without nesting modals.
export default function ExamDialogLayout({embedded,children,actions,className,bodyClassName,...props}){
 if(!embedded)return <Modal {...props} className={className} bodyClassName={bodyClassName} actions={actions}>{children}</Modal>;
 return <div className={`ep-inline-editor ${className||''}`}>
  <div className={bodyClassName}>{children}</div>
  <footer className="ep-inline-editor-actions">{actions}</footer>
 </div>;
}
