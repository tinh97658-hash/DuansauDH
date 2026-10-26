export const SUBJECT_KNOWLEDGE_GROUPS = [
  {code:'KC',name:'Kiến thức chung',sortOrder:0},
  {code:'CS',name:'Kiến thức ngành',sortOrder:1},
  {code:'CN',name:'Kiến thức chuyên ngành',sortOrder:2},
  {code:'TT',name:'Thực tập',sortOrder:3},
  {code:'TN',name:'Tốt nghiệp',sortOrder:4},
] as const;
export const SUBJECT_KNOWLEDGE_CODES=SUBJECT_KNOWLEDGE_GROUPS.map(group=>group.code);
