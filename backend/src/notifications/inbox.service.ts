import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Staff } from '../database/models/staff.model.js';
import { workingProfileStorage } from '../auth/profile-context.js';
import { InboxAccessService, type Audience } from './inbox-access.service.js';
import { eventTitles, type InboxKind } from './inbox-events.js';
import { inboxEnabled } from './inbox-sync.service.js';

interface Delivery { id: string; entity_id: string; kind: InboxKind; audience: Audience; read_at: Date | null; occurred_at: Date; }
@Injectable()
export class InboxService {
  constructor(private readonly db: Sequelize, private readonly access: InboxAccessService, private readonly config: ConfigService) {}

  private identity(user: unknown) {
    const context = workingProfileStorage.getStore();
    if (!(user instanceof Staff) || user.status !== 'active' || !context?.roleId || context.staffId !== user.id || context.selectionRequired) throw new ForbiddenException('Hồ sơ làm việc không hợp lệ.');
    if (!inboxEnabled(this.config)) throw new ServiceUnavailableException('Thông báo chưa được kích hoạt trên môi trường này.');
    return { user, profile: context.roleId };
  }
  private async visible(user: Staff, profile: string) {
    const result: any[] = [], targets = new Map<string, any>();
    let offset = 0;
    // Filter under current business RLS before pagination/count; never count hidden rows.
    for (;;) {
      const rows = await this.db.query<Delivery>(`SELECT d.id,d.read_at,d.audience,e.kind,e.entity_id,e.occurred_at
        FROM notification_deliveries d JOIN notification_events e ON e.id=d.event_id
        WHERE d.staff_id=:staff AND d.profile_id=:profile
        ORDER BY e.occurred_at DESC,d.id DESC LIMIT 500 OFFSET :offset`,
      { type: QueryTypes.SELECT, replacements: { staff: user.id, profile, offset } });
      for (const row of rows) {
        if (!Object.hasOwn(eventTitles, row.kind)) continue;
        const key = `${row.kind}:${row.entity_id}:${row.audience}`;
        if (!targets.has(key)) targets.set(key, await this.access.target(user, profile, { kind: row.kind, entityId: row.entity_id }, row.audience));
        const target = targets.get(key);
        if (target) result.push({ id: row.id, type: row.kind, title: eventTitles[row.kind],
          body: target.label, href: target.href, occurredAt: row.occurred_at, readAt: row.read_at });
      }
      if (rows.length < 500) break;
      offset += rows.length;
    }
    return result;
  }
  async list(actor: unknown, page = 1, pageSize = 6) {
    const { user, profile } = this.identity(actor), visible = await this.visible(user, profile);
    return { items: visible.slice((page - 1) * pageSize, page * pageSize), total: visible.length,
      unreadCount: visible.filter(item => !item.readAt).length, page, pageSize };
  }
  async unread(actor: unknown) { const { user, profile } = this.identity(actor); return { unreadCount: (await this.visible(user, profile)).filter(item => !item.readAt).length }; }
  async read(actor: unknown, id: string) {
    const { user, profile } = this.identity(actor);
    const item = (await this.visible(user, profile)).find(value => value.id === id);
    if (!item) throw new NotFoundException('Không tìm thấy thông báo trong phạm vi hiện tại.');
    const [updated] = await this.db.query<{ read_at: Date }>(`UPDATE notification_deliveries SET read_at=COALESCE(read_at,clock_timestamp())
      WHERE id=:id AND staff_id=:staff AND profile_id=:profile RETURNING read_at`, { type: QueryTypes.SELECT, replacements: { id, staff: user.id, profile } });
    if (!updated) throw new NotFoundException('Không tìm thấy thông báo trong phạm vi hiện tại.');
    return { item: { ...item, readAt: updated.read_at } };
  }
  async readAll(actor: unknown) {
    const { user, profile } = this.identity(actor), items = await this.visible(user, profile);
    const ids = items.filter(item => !item.readAt).map(item => item.id);
    const updated = ids.length ? await this.db.query<{ id: string }>(`UPDATE notification_deliveries SET read_at=clock_timestamp()
      WHERE id IN (:ids) AND staff_id=:staff AND profile_id=:profile AND read_at IS NULL RETURNING id`,
    { type: QueryTypes.SELECT, replacements: { ids, staff: user.id, profile } }) : [];
    return { updated: updated.length };
  }
}
