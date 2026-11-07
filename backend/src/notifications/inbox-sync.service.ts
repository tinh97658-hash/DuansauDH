import { randomUUID } from 'node:crypto';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryTypes, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RbacService } from '../auth/rbac.service.js';
import { groupScopeStorage } from '../auth/group-scope-context.js';
import { workingProfileStorage } from '../auth/profile-context.js';
import { InboxAccessService, type InboxActor } from './inbox-access.service.js';
import { eventsFromChange, eventTitles, needsApprover, requestKind, type AuditChange, type InboxEvent } from './inbox-events.js';

export const inboxEnabled = (config: ConfigService) => String(config.get('NOTIFICATION_V2_ENABLED', 'false')) === 'true';

@Injectable()
export class InboxSyncService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(InboxSyncService.name);
  constructor(private readonly db: Sequelize, private readonly access: InboxAccessService,
    private readonly rbac: RbacService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (!inboxEnabled(this.config)) return;
    const tick = () => this.sync().catch(() => this.logger.error('Notification sync failed; persisted source remains available for retry.'));
    void tick();
    this.timer = setInterval(tick, 45_000);
    this.timer.unref?.();
  }
  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running; }

  sync(): Promise<void> {
    if (!inboxEnabled(this.config)) return Promise.resolve();
    if (this.running) return this.running;
    // A worker never inherits an HTTP caller's profile or RLS transaction.
    this.running = groupScopeStorage.exit(() => workingProfileStorage.exit(() => this.process()))
      .finally(() => { this.running = undefined; });
    return this.running;
  }
  private select<T extends object>(sql: string, replacements: Record<string, any> = {}, transaction?: Transaction) {
    return this.db.query<T>(sql, { type: QueryTypes.SELECT, replacements, transaction });
  }
  private async process() {
    await this.db.transaction(async transaction => {
      const [lock] = await this.select<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock(77109403) AS locked', {}, transaction);
      if (!lock.locked) return;
      const changes = await this.select<AuditChange>(`SELECT c.* FROM db_change_logs c
        WHERE c.id > (SELECT activated_after_change_id FROM notification_activation WHERE id=true)
          AND c.table_name IN ('gradebook_events','study_leaves','major_transfers')
          AND NOT EXISTS(SELECT 1 FROM notification_ingested_changes receipt WHERE receipt.change_id=c.id)
        ORDER BY c.id LIMIT 100`, {}, transaction);
      if (!changes.length) return;
      const staff = await this.select<InboxActor>("SELECT id,role,status FROM staff WHERE status='active'", {}, transaction);
      // Resolve all assigned profiles, not only the recipient's currently open session.
      const profiles = new Map<string, Awaited<ReturnType<RbacService['profiles']>>>();
      for (const actor of staff) profiles.set(actor.id, await this.rbac.profiles(actor));
      for (const change of changes) {
        for (const event of eventsFromChange(change)) {
          await this.db.query(`INSERT INTO notification_events
            (id,source_key,change_id,source_record_id,entity_id,kind,occurred_at,actor_staff_id,actor_profile_id,title)
            VALUES(:id,:sourceKey,:changeId,:sourceRecordId,:entityId,:kind,:occurredAt,:actorStaffId,:actorProfileId,:title)
            ON CONFLICT(source_key) DO NOTHING`, { transaction, replacements: { ...event, id: randomUUID(), title: eventTitles[event.kind] } });
          const [stored] = await this.select<{ id: string }>('SELECT id FROM notification_events WHERE source_key=:key', { key: event.sourceKey }, transaction);
          const sender = event.kind.endsWith('.requested') || event.kind === 'grade.submitted' ? null : await this.sender(event, transaction);
          for (const actor of staff) for (const profile of profiles.get(actor.id) || []) {
            if (actor.id === event.actorStaffId) continue;
            const relatedSender = sender?.staffId === actor.id && sender?.profileId === profile.id;
            const audience = relatedSender && await this.access.target(actor, profile.id, event, 'sender') ? 'sender'
              : needsApprover(event.kind) && await this.access.target(actor, profile.id, event, 'approver') ? 'approver' : null;
            if (!audience) continue;
            await this.db.query(`INSERT INTO notification_deliveries(id,event_id,staff_id,profile_id,audience)
              VALUES(:id,:event,:staff,:profile,:audience) ON CONFLICT(event_id,staff_id,profile_id) DO NOTHING`,
            { transaction, replacements: { id: randomUUID(), event: stored.id, staff: actor.id, profile: profile.id, audience } });
          }
        }
        await this.db.query('INSERT INTO notification_ingested_changes(change_id) VALUES(:id) ON CONFLICT DO NOTHING', { transaction, replacements: { id: String(change.id) } });
      }
    });
  }

  private async sender(event: InboxEvent, transaction: Transaction) {
    const grade = event.kind.startsWith('grade.'), transfer = event.kind.startsWith('transfer.');
    const table = grade ? 'gradebook_events' : transfer ? 'major_transfers' : 'study_leaves';
    // Correlation may read pre-activation requests, without backfilling their inbox.
    const changes = await this.select<AuditChange>(`SELECT * FROM db_change_logs
      WHERE table_name=:table AND id < :change AND new_data->>${grade ? "'course_offering_id'" : "'id'"}=:id
      ORDER BY id DESC`, { table, change: event.changeId, id: grade ? event.entityId : event.sourceRecordId }, transaction);
    for (const change of changes) {
      const match = eventsFromChange(change).reverse().find(candidate => candidate.kind === requestKind(event.kind));
      if (match) return match.actorStaffId && match.actorProfileId ? { staffId: match.actorStaffId, profileId: match.actorProfileId } : null;
    }
    return null;
  }
}
