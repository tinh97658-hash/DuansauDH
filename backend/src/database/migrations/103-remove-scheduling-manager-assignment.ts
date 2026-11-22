import type { QueryInterface } from 'sequelize';

// Assignment was informational; scheduling access continues to use role permissions.
export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    // Role grants, scopes and permission dependencies cascade with these permissions.
    await qi.sequelize.query(`
      DELETE FROM permissions WHERE code IN (
        'scheduling.assign',
        'route.system.accounts.scheduling-assign',
        'route.masters.course-offerings.scheduling-assign'
      );
      ALTER TABLE staff DROP COLUMN IF EXISTS can_manage_scheduling;
    `, { transaction });
  });
}

export async function down() {
  throw new Error('Scheduling manager assignments and grants were removed; restore a backup to recover them.');
}
