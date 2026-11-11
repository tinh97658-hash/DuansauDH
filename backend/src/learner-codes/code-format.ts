import { BadRequestException } from '@nestjs/common';

export type CodePart = { kind: 'major' | 'year' | 'round' | 'group' | 'sequence' | 'literal' | 'manual'; width?: number; value?: string };
export const DEFAULT_CODE_PARTS: CodePart[] = [
  { kind: 'major' }, { kind: 'year', width: 2 }, { kind: 'round', width: 1 },
  { kind: 'group', width: 1 }, { kind: 'sequence', width: 3 },
];
export function validateParts(parts: CodePart[]) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 12
    || parts.filter(part => part.kind === 'sequence').length !== 1) throw new BadRequestException('Mẫu phải có đúng một thành phần số tự tăng.');
  for (const part of parts) {
    if (!['major','year','round','group','sequence','literal','manual'].includes(part.kind)
      || (part.width !== undefined && (!Number.isInteger(part.width) || part.width < 1 || part.width > 12))
      || (part.kind === 'literal' && !/^[A-Z0-9.-]{1,12}$/.test(part.value || ''))
      || (part.kind === 'year' && ![2,4].includes(part.width || 2))) throw new BadRequestException('Thành phần mẫu mã không hợp lệ.');
  }
  return parts;
}
export function formatLearnerCode(parts: CodePart[], input: any, sequence: number, letter: string | null, manual = '') {
  validateParts(parts);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new BadRequestException('Số thứ tự không hợp lệ.');
  const number = (value: any, width: number) => {
    const text = String(value ?? '');
    if (!/^\d+$/.test(text) || text.length > width) throw new BadRequestException('Thiếu dữ liệu hoặc số vượt độ dài cấu hình.');
    return text.padStart(width, '0');
  };
  const components = parts.map(part => {
    switch (part.kind) {
      case 'major': if (!/^[A-Z0-9]{2,12}$/.test(input.abbreviation || '')) throw new BadRequestException('Chuyên ngành chưa có viết tắt mã học viên.'); return input.abbreviation;
      case 'year': if (!/^\d{4}$/.test(input.academicYear || '')) throw new BadRequestException('Năm đào tạo không hợp lệ.'); return input.academicYear.slice(-(part.width || 2));
      case 'round': return number(input.intakeRound, part.width || 1);
      case 'group': return number(input.groupNumber, part.width || 1);
      case 'sequence': return number(sequence, (part.width || 3) - (letter ? 1 : 0)) + (letter || '');
      case 'literal': return part.value!;
      case 'manual': if (!new RegExp(`^[A-Z0-9]{${part.width || 3}}$`).test(manual)) throw new BadRequestException('Phần nhập tay không đúng độ dài hoặc ký tự.'); return manual;
    }
  });
  const code = components.join('');
  if (code.length > 50) throw new BadRequestException('Mã vượt giới hạn 50 ký tự.');
  return { code, components };
}

export function codeCounterKey(scope: string, input: any) {
  const keys: Record<string, any[]> = {
    global: [], year: [input.academicYear], major_year: [input.majorId,input.academicYear],
    major_round: [input.majorId,input.academicYear,input.intakeRound],
    class: [input.majorId,input.academicYear,input.intakeRound,input.classGroupId],
  };
  if (!Object.hasOwn(keys, scope)) throw new BadRequestException('Phạm vi bộ đếm không hợp lệ.');
  return JSON.stringify([scope,input.program,input.typeId,...keys[scope]]);
}
export function codeRulePriority(rule:any) {
  const base=rule.class_group_id?1000:rule.major_id?(rule.academic_year?(rule.intake_round?800:700):600):rule.program?400:200;
  return base + (!rule.major_id&&!rule.class_group_id?(rule.academic_year?20:0)+(rule.intake_round?10:0):0)+(rule.type_id?1:0);
}

/** For a shared counter, honor the narrowest applicable format. A class counter
 * can resolve its exact winning rule; wider counters may serve several rules. */
export function codeCounterMaximum(key:string, types:any[], rules:any[]) {
  let parts:any;
  try { parts=JSON.parse(key); } catch { throw new BadRequestException('Khóa bộ đếm không hợp lệ.'); }
  const lengths:Record<string,number>={global:3,year:4,major_year:5,major_round:6,class:7};
  if(!Array.isArray(parts)||!Object.hasOwn(lengths,parts[0])||parts.length!==lengths[parts[0]])throw new BadRequestException('Khóa bộ đếm không hợp lệ.');
  const [scope,program,typeId]=parts;
  const type=types.find(row=>row.id===typeId&&row.active);
  if(!type||(type.key!=='regular'&&!type.letter))throw new BadRequestException('Loại hồ sơ chưa có cấu hình cấp mã hợp lệ.');
  const input:any={program,type_id:typeId};
  if(scope==='year')input.academic_year=parts[3];
  if(['major_year','major_round','class'].includes(scope)){input.major_id=parts[3];input.academic_year=parts[4];}
  if(['major_round','class'].includes(scope))input.intake_round=parts[5];
  if(scope==='class')input.class_group_id=parts[6];
  let candidates=rules.filter(rule=>Object.entries(input).every(([field,value])=>rule[field]==null||String(rule[field])===String(value)));
  if(scope==='class'){
    candidates.sort((a,b)=>codeRulePriority(b)-codeRulePriority(a));
    if(candidates[1]&&codeRulePriority(candidates[0])===codeRulePriority(candidates[1]))throw new BadRequestException('Quy tắc bộ đếm không xác định duy nhất.');
    candidates=candidates.slice(0,1).filter(rule=>rule.counter_scope===scope);
  }else candidates=candidates.filter(rule=>rule.counter_scope===scope);
  if(!candidates.length)throw new BadRequestException('Bộ đếm không còn quy tắc đang áp dụng.');
  return Math.min(...candidates.map(rule=>{
    validateParts(rule.parts);
    const width=(rule.parts.find((part:CodePart)=>part.kind==='sequence').width||3)-(type.letter?1:0);
    if(width<1)throw new BadRequestException('Đoạn số tự tăng không còn đủ độ dài.');
    return 10**width-1;
  }));
}
