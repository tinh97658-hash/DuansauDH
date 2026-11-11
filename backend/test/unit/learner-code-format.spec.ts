import { codeCounterKey, codeCounterMaximum, codeRulePriority, DEFAULT_CODE_PARTS, formatLearnerCode, validateParts } from '../../src/learner-codes/code-format.js';
const input={abbreviation:'CN',academicYear:'2026',intakeRound:1,groupNumber:2,program:'masters',majorId:'m',classGroupId:'c',typeId:'regular'};
it('giới hạn số theo đoạn đuôi và chữ cái, chọn đúng quy tắc ưu tiên',()=>{
  const types=[{id:'regular',key:'regular',active:true,letter:null},{id:'special',key:'special',active:true,letter:'B'}];
  const generic={counter_scope:'class',parts:DEFAULT_CODE_PARTS};
  expect(codeCounterMaximum(codeCounterKey('class',input),types,[generic])).toBe(999);
  expect(codeCounterMaximum(codeCounterKey('class',{...input,typeId:'special'}),types,[generic])).toBe(99);
  const wider={...generic,type_id:'special',parts:[{kind:'sequence',width:4}]};
  expect(codeCounterMaximum(codeCounterKey('class',{...input,typeId:'special'}),types,[generic,wider])).toBe(999);
});
it('bộ đếm chung dùng giới hạn an toàn cho các mẫu cùng phục vụ',()=>{
  const types=[{id:'regular',key:'regular',active:true,letter:null}];
  const rules=[{counter_scope:'global',parts:[{kind:'sequence',width:4}]},
    {counter_scope:'global',class_group_id:'other',parts:[{kind:'sequence',width:3}]}];
  expect(codeCounterMaximum(codeCounterKey('global',input),types,rules)).toBe(999);
  expect(()=>codeCounterMaximum('invalid',types,rules)).toThrow();
});
it('keeps a three-digit regular suffix and replaces the last digit with the configured letter for a special type',()=>{
  expect(formatLearnerCode(DEFAULT_CODE_PARTS,input,1,null).code).toBe('CN2612001');
  expect(formatLearnerCode(DEFAULT_CODE_PARTS,input,1,'B').code).toBe('CN261201B');
  expect(formatLearnerCode(DEFAULT_CODE_PARTS,input,2,'H').code).toBe('CN261202H');
});
it('separates counters by stable type and class identities',()=>{
  expect(codeCounterKey('class',input)).not.toBe(codeCounterKey('class',{...input,typeId:'special'}));
  expect(codeCounterKey('class',input)).not.toBe(codeCounterKey('class',{...input,classGroupId:'other'}));
  expect(codeCounterKey('class',input)).toBe(codeCounterKey('class',{...input,abbreviation:'XX'}));
});
it('prefers the type-specific rule over the generic rule at the same scope',()=>{
  expect(codeRulePriority({type_id:'special'})).toBeGreaterThan(codeRulePriority({}));
  expect(codeRulePriority({class_group_id:'class'})).toBeGreaterThan(codeRulePriority({major_id:'major',academic_year:'2026',intake_round:1,type_id:'special'}));
});
it('rejects overflow instead of truncating or wrapping',()=>{
  expect(()=>formatLearnerCode(DEFAULT_CODE_PARTS,input,100,'B')).toThrow();
  expect(()=>formatLearnerCode(DEFAULT_CODE_PARTS,input,1000,null)).toThrow();
  expect(()=>formatLearnerCode(DEFAULT_CODE_PARTS,{...input,intakeRound:10},1,null)).toThrow();
});
it('supports reordering, separators, four-digit years and zero-preserving manual segments',()=>{
  expect(formatLearnerCode([{kind:'year',width:4},{kind:'literal',value:'-'},{kind:'manual',width:3},{kind:'sequence',width:4}],input,37,'B','001').code).toBe('2026-001037B');
  expect(()=>validateParts([{kind:'literal',value:'evil()'}])).toThrow();
  expect(()=>validateParts([{kind:'sequence'},{kind:'sequence'}])).toThrow();
});
