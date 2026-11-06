import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';
import { InboxAccessService } from './inbox-access.service.js';
import { InboxSyncService } from './inbox-sync.service.js';

@Module({ imports: [DatabaseModule], controllers: [InboxController], providers: [InboxService, InboxAccessService, InboxSyncService] })
export class InboxModule {}
