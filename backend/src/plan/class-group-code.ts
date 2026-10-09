import { BadRequestException } from "@nestjs/common";

export function classGroupCode(majorCode: string, year: string, round: number, number: number) {
  const prefix = String(majorCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,30}$/.test(prefix)) throw new BadRequestException("Mã chuyên ngành phải gồm chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.");
  if (!/^\d{4}$/.test(String(year)) || !Number.isInteger(round) || round < 1 || round > 99 || !Number.isInteger(number) || number < 1 || number > 2147483647) {
    throw new BadRequestException("Năm, đợt và số nhóm không hợp lệ.");
  }
  return `${prefix} ${year}.${round}.${number}`;
}

export function parseClassGroupCode(code: string) {
  const match = /^([A-Z0-9_-]+) (\d{4})\.(\d+)\.(\d+)$/.exec(String(code || "").trim().toUpperCase());
  return match ? { majorCode: match[1], academicYear: match[2], intakeRound: Number(match[3]), groupNumber: Number(match[4]) } : null;
}
