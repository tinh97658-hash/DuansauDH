import { GroupScopeService } from '../../src/auth/group-scope.service.js';

const access = { permissions: new Set(['scheduling.view']), roleCodes: ['reader'],
  groupScope: { restrictView: true, restrictEdit: true, readOnly: false } };

function setup() {
  const committed: any[] = [], rolledBack: any[] = [];
  const rawQuery = jest.fn(async (_sql: any, _options: any) => []);
  let serial = 0;
  const db: any = { query: rawQuery, transaction: jest.fn(async (work: any) => {
    const tx = { id: ++serial };
    try { const result = await work(tx); committed.push(tx); return result; }
    catch (error) { rolledBack.push(tx); throw error; }
  }) };
  const scope = new GroupScopeService(db);
  scope.onModuleInit();
  return { db, scope, rawQuery, committed, rolledBack };
}

it('uses one protected transaction for all queries in a read request and restores the parent context', async () => {
  const { db, scope, rawQuery, committed } = setup();
  await scope.run('staff-a', access, async () => {
    await scope.withReadTransaction(async () => {
      await db.query('SELECT first');
      await scope.withReadTransaction(() => db.query('SELECT second'));
    });
    expect(scope.current()?.readTransaction).toBeUndefined();
  }, true, 'view');
  const reads = rawQuery.mock.calls.filter(([sql]) => String(sql).startsWith('SELECT first') || sql === 'SELECT second');
  expect(reads[0][1].transaction).toBe(reads[1][1].transaction);
  expect(rawQuery.mock.calls.filter(([sql]) => String(sql).includes('set_config'))).toHaveLength(1);
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(committed).toHaveLength(1);
});

it('does not share actor settings or transactions between concurrent requests', async () => {
  const { db, scope, rawQuery } = setup();
  await Promise.all(['staff-a', 'staff-b'].map(staff => scope.run(staff, access,
    () => scope.withReadTransaction(() => db.query('SELECT actor')), true, 'view')));
  const configurations = rawQuery.mock.calls.filter(([sql]) => String(sql).includes('set_config'));
  expect(configurations.map(([, options]) => options.replacements.staffId).sort()).toEqual(['staff-a', 'staff-b']);
  expect(configurations[0][1].transaction).not.toBe(configurations[1][1].transaction);
  expect(scope.current()).toBeUndefined();
});

it('serializes parallel loaders on the request client', async () => {
  const { db, scope, rawQuery } = setup();
  let active = 0, maximum = 0;
  rawQuery.mockImplementation(async () => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return [];
  });
  await scope.run('staff-a', access, () => scope.withReadTransaction(async () => {
    await Promise.all([db.query('SELECT first'), db.query('SELECT second'), db.query('SELECT third')]);
  }), true, 'view');
  expect(maximum).toBe(1);
  expect(db.transaction).toHaveBeenCalledTimes(1);
});

it('rolls back failed reads and continues to use explicit transactions for write operations', async () => {
  const { db, scope, rawQuery, rolledBack } = setup();
  await expect(scope.run('staff-a', access, () => scope.withReadTransaction(async () => {
    await db.query('SELECT first');
    throw new Error('cancelled');
  }), true, 'view')).rejects.toThrow('cancelled');
  expect(rolledBack).toHaveLength(1);
  const explicit = { id: 'write-transaction' };
  await scope.run('staff-a', access, () => db.query('UPDATE example', { transaction: explicit }), false, 'write');
  expect(rawQuery.mock.calls.find(([sql]) => sql === 'UPDATE example')?.[1].transaction).toBe(explicit);
  expect(rawQuery.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_xact_lock_shared'))).toBe(true);
});
