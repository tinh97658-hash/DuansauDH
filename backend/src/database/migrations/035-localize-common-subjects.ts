import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";

type LegacyEntry = {
  entry_id: string;
  curriculum_id: string;
  target_major_id: string;
  target_major_code: string;
  subject_id: string;
  code: string;
  code_number: number;
  code_text: string;
  name: string;
  program: string;
  credits: number;
  major_assignment: boolean;
  subject_type: string;
  is_required: boolean;
  sort_order: number;
  active: boolean;
};

/**
 * Chuyển mô hình cũ "một học phần KC cấp Viện dùng cùng mã cho mọi ngành"
 * thành một bản ghi học phần độc lập cho từng chuyên ngành. Quan hệ học chung
 * được xác định bởi tên + số tín chỉ và cờ allow_cross_major, không bởi mã.
 */
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`
      UPDATE subjects
      SET allow_cross_major = TRUE, updated_at = NOW()
      WHERE subject_type = 'KC' AND allow_cross_major = FALSE
    `, { transaction });

    const entries = await qi.sequelize.query(`
      SELECT cs.id AS entry_id,
             cs.curriculum_id,
             c.major_id AS target_major_id,
             target_major.code AS target_major_code,
             s.id AS subject_id,
             s.code,
             s.code_number,
             s.code_text,
             s.name,
             s.program,
             s.credits,
             s.major_assignment,
             s.subject_type,
             s.is_required,
             s.sort_order,
             s.active
      FROM curriculum_subjects cs
      JOIN curriculums c ON c.id = cs.curriculum_id
      JOIN majors target_major ON target_major.id = c.major_id
      JOIN subjects s ON s.id = cs.subject_id
      WHERE s.major_id <> c.major_id
        AND target_major.code <> 'CHUNG'
        AND s.program::text = c.program::text
      ORDER BY c.major_id, s.id, cs.id
    `, { type: QueryTypes.SELECT, transaction }) as LegacyEntry[];

    const localizedByMajorAndSubject = new Map<string, string>();
    for (const entry of entries) {
      const mappingKey = `${entry.target_major_id}:${entry.subject_id}`;
      let localSubjectId = localizedByMajorAndSubject.get(mappingKey);

      if (!localSubjectId) {
        const equivalents = await qi.sequelize.query(`
          SELECT id
          FROM subjects
          WHERE major_id = :majorId
            AND program = :program
            AND lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(:name), '\\s+', ' ', 'g'))
            AND credits = :credits
          ORDER BY active DESC, created_at ASC
          LIMIT 1
        `, {
          replacements: {
            majorId: entry.target_major_id,
            program: entry.program,
            name: entry.name,
            credits: entry.credits,
          },
          type: QueryTypes.SELECT,
          transaction,
        }) as Array<{ id: string }>;

        localSubjectId = equivalents[0]?.id;
        if (!localSubjectId) {
          const usedCodes = await qi.sequelize.query(`
            SELECT code_number, code_text
            FROM subjects
            WHERE major_id = :majorId AND program = :program
          `, {
            replacements: { majorId: entry.target_major_id, program: entry.program },
            type: QueryTypes.SELECT,
            transaction,
          }) as Array<{ code_number: number; code_text: string }>;
          const usedNumbers = new Set(usedCodes.map((row) => Number(row.code_number)));
          const usedTexts = new Set(usedCodes.map((row) => String(row.code_text || "").toUpperCase()));
          let codeNumber = Number(entry.code_number) || 1;
          while (usedNumbers.has(codeNumber)) codeNumber += 1;
          const suffix = `-${entry.target_major_code}`;
          const base = String(entry.code_text || entry.code || `HP${codeNumber}`).toUpperCase();
          let codeText = base.slice(0, 20);
          let sequence = 1;
          while (usedTexts.has(codeText)) {
            const numberedSuffix = `${suffix}${sequence > 1 ? sequence : ""}`;
            codeText = `${base.slice(0, Math.max(1, 20 - numberedSuffix.length))}${numberedSuffix}`;
            sequence += 1;
          }

          localSubjectId = randomUUID();
          await qi.sequelize.query(`
            INSERT INTO subjects (
              id, code, code_number, code_text, name, major_id, program,
              canonical_subject_id, allow_cross_major, credits, major_assignment,
              subject_type, is_required, sort_order, active, created_at, updated_at
            ) VALUES (
              :id, :codeText, :codeNumber, :codeText, :name, :majorId, :program,
              NULL, TRUE, :credits, :majorAssignment,
              :subjectType, :isRequired, :sortOrder, :active, NOW(), NOW()
            )
          `, {
            replacements: {
              id: localSubjectId,
              codeText,
              codeNumber,
              name: entry.name,
              majorId: entry.target_major_id,
              program: entry.program,
              credits: entry.credits,
              majorAssignment: entry.major_assignment,
              subjectType: entry.subject_type,
              isRequired: entry.is_required,
              sortOrder: entry.sort_order,
              active: entry.active,
            },
            transaction,
          });
        } else {
          await qi.sequelize.query(`
            UPDATE subjects SET allow_cross_major = TRUE, updated_at = NOW() WHERE id = :id
          `, { replacements: { id: localSubjectId }, transaction });
        }
        localizedByMajorAndSubject.set(mappingKey, localSubjectId);
      }

      const duplicate = await qi.sequelize.query(`
        SELECT id FROM curriculum_subjects
        WHERE curriculum_id = :curriculumId AND subject_id = :subjectId AND id <> :entryId
        LIMIT 1
      `, {
        replacements: { curriculumId: entry.curriculum_id, subjectId: localSubjectId, entryId: entry.entry_id },
        type: QueryTypes.SELECT,
        transaction,
      }) as Array<{ id: string }>;
      if (duplicate.length > 0) {
        await qi.sequelize.query(`
          INSERT INTO class_group_electives (
            id, class_group_id, curriculum_subject_id, created_at, updated_at
          )
          SELECT gen_random_uuid(), class_group_id, :retainedEntryId, NOW(), NOW()
          FROM class_group_electives
          WHERE curriculum_subject_id = :removedEntryId
          ON CONFLICT (class_group_id, curriculum_subject_id) DO NOTHING
        `, {
          replacements: {
            retainedEntryId: duplicate[0].id,
            removedEntryId: entry.entry_id,
          },
          transaction,
        });
        await qi.sequelize.query(`DELETE FROM curriculum_subjects WHERE id = :entryId`, {
          replacements: { entryId: entry.entry_id }, transaction,
        });
      } else {
        await qi.sequelize.query(`
          UPDATE curriculum_subjects SET subject_id = :subjectId, updated_at = NOW() WHERE id = :entryId
        `, {
          replacements: { subjectId: localSubjectId, entryId: entry.entry_id }, transaction,
        });
      }
    }
  });
}

// Không tự động gộp ngược vì sau migration mã học phần theo ngành có thể đã được chỉnh sửa.
export async function down() {}
