/**
 * SyncService — Handles bidirectional sync between local SQLite (desktop/mobile)
 * and cloud D1 database. Supports delta sync, conflict resolution, and batch ops.
 */

import { D1Database } from '@cloudflare/workers-types';

interface SyncPushRecord {
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  client_timestamp: string;
}

interface SyncPushRequest {
  client_id: string;
  records: SyncPushRecord[];
  last_pull_timestamp?: string;
}

interface SyncPushResult {
  accepted: number;
  rejected: number;
  conflicts: Array<{
    table_name: string;
    record_id: string;
    server_payload: any;
    client_payload: any;
    resolution: 'server_wins' | 'client_wins';
  }>;
  server_timestamp: string;
}

interface SyncPullRequest {
  client_id: string;
  since?: string;
  tables?: string[];
  limit?: number;
}

interface SyncPullResult {
  records: Array<{
    table_name: string;
    record_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    server_timestamp: string;
  }>;
  server_timestamp: string;
  has_more: boolean;
}

interface SyncChangesRequest {
  since: string;
  tables?: string[];
  limit?: number;
}

const TRACKED_TABLES = [
  'service_records',
  'clients',
  'technicians',
  'inventory_stock',
  'inventory_items',
  'expenses',
  'invoices',
  'cash_transactions',
  'attendance_log',
];

export class SyncService {
  constructor(private db: D1Database) {}

  /**
   * Push client changes to server. Resolves conflicts using last-write-wins.
   */
  async push(request: SyncPushRequest): Promise<SyncPushResult> {
    const { client_id, records, last_pull_timestamp } = request;
    const conflicts: SyncPushResult['conflicts'] = [];
    let accepted = 0;
    let rejected = 0;

    for (const record of records) {
      if (!TRACKED_TABLES.includes(record.table_name)) {
        rejected++;
        continue;
      }

      try {
        if (record.operation === 'DELETE') {
          await this.applyDelete(record);
        } else {
          const conflict = await this.checkConflict(record, last_pull_timestamp);
          if (conflict) {
            const resolution = this.resolveConflict(conflict, record);
            conflicts.push({
              table_name: record.table_name,
              record_id: record.record_id,
              server_payload: conflict.server_payload,
              client_payload: record.payload,
              resolution,
            });
            if (resolution === 'client_wins') {
              await this.applyUpsert(record);
            }
          } else {
            await this.applyUpsert(record);
          }
        }

        await this.recordSyncMeta(record, client_id);
        accepted++;
      } catch (err) {
        console.error(`Sync push error for ${record.table_name}/${record.record_id}:`, err);
        rejected++;
      }
    }

    const server_timestamp = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT INTO sync_log (client_id, direction, records_synced, conflicts_resolved, status) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(client_id, 'push', accepted, conflicts.length, rejected === 0 ? 'success' : 'partial')
      .run();

    return { accepted, rejected, conflicts, server_timestamp };
  }

  /**
   * Pull changes from server since a given timestamp.
   */
  async pull(request: SyncPullRequest): Promise<SyncPullResult> {
    const { client_id, since, tables, limit = 500 } = request;
    const targetTables = tables?.filter((t) => TRACKED_TABLES.includes(t)) || TRACKED_TABLES;
    const records: SyncPullResult['records'] = [];

    for (const tableName of targetTables) {
      const tableRecords = await this.getChangesFromTable(tableName, since, limit - records.length);
      records.push(...tableRecords);
      if (records.length >= limit) break;
    }

    const server_timestamp = new Date().toISOString();

    await this.db
      .prepare(
        'INSERT INTO sync_log (client_id, direction, records_synced, status) VALUES (?, ?, ?, ?)'
      )
      .bind(client_id, 'pull', records.length, 'success')
      .run();

    return {
      records: records.slice(0, limit),
      server_timestamp,
      has_more: records.length > limit,
    };
  }

  /**
   * Get raw changes since a timestamp (for admin/debug).
   */
  async getChanges(request: SyncChangesRequest): Promise<SyncPullResult> {
    const { since, tables, limit = 1000 } = request;
    const targetTables = tables?.filter((t) => TRACKED_TABLES.includes(t)) || TRACKED_TABLES;
    const records: SyncPullResult['records'] = [];

    for (const tableName of targetTables) {
      const tableRecords = await this.getChangesFromTable(tableName, since, limit - records.length);
      records.push(...tableRecords);
      if (records.length >= limit) break;
    }

    return {
      records: records.slice(0, limit),
      server_timestamp: new Date().toISOString(),
      has_more: records.length > limit,
    };
  }

  /**
   * Get sync status for a client.
   */
  async getStatus(client_id: string): Promise<{
    last_push: string | null;
    last_pull: string | null;
    pending_push: number;
    total_synced: number;
  }> {
    const lastPush = await this.db
      .prepare('SELECT timestamp FROM sync_log WHERE client_id = ? AND direction = ? ORDER BY timestamp DESC LIMIT 1')
      .bind(client_id, 'push')
      .first<{ timestamp: string }>();

    const lastPull = await this.db
      .prepare('SELECT timestamp FROM sync_log WHERE client_id = ? AND direction = ? ORDER BY timestamp DESC LIMIT 1')
      .bind(client_id, 'pull')
      .first<{ timestamp: string }>();

    const pendingPush = await this.db
      .prepare('SELECT COUNT(*) as count FROM sync_meta WHERE synced = 0')
      .first<{ count: number }>();

    const totalSynced = await this.db
      .prepare('SELECT COUNT(*) as count FROM sync_meta WHERE synced = 1')
      .first<{ count: number }>();

    return {
      last_push: lastPush?.timestamp || null,
      last_pull: lastPull?.timestamp || null,
      pending_push: pendingPush?.count || 0,
      total_synced: totalSynced?.count || 0,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async applyUpsert(record: SyncPushRecord): Promise<void> {
    const columns = Object.keys(record.payload);
    const values = Object.values(record.payload);
    const placeholders = columns.map(() => '?').join(', ');

    const existing = await this.db
      .prepare(`SELECT rowid FROM ${record.table_name} WHERE id = ?`)
      .bind(record.record_id)
      .first();

    if (existing) {
      const setClause = columns.map((c) => `${c} = ?`).join(', ');
      await this.db
        .prepare(`UPDATE ${record.table_name} SET ${setClause} WHERE id = ?`)
        .bind(...values, record.record_id)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO ${record.table_name} (id, ${columns.join(', ')}) VALUES (?, ${placeholders})`
        )
        .bind(record.record_id, ...values)
        .run();
    }
  }

  private async applyDelete(record: SyncPushRecord): Promise<void> {
    await this.db
      .prepare(`DELETE FROM ${record.table_name} WHERE id = ?`)
      .bind(record.record_id)
      .run();
  }

  private async checkConflict(
    record: SyncPushRecord,
    last_pull_timestamp?: string
  ): Promise<{ server_payload: any; server_updated_at: string } | null> {
    const existing = await this.db
      .prepare(`SELECT * FROM ${record.table_name} WHERE id = ?`)
      .bind(record.record_id)
      .first();

    if (!existing) return null;

    const serverTimestamp =
      (existing as any).updated_at || (existing as any).created_at || '';

    if (last_pull_timestamp && serverTimestamp > last_pull_timestamp) {
      return {
        server_payload: existing,
        server_updated_at: serverTimestamp,
      };
    }

    return null;
  }

  private resolveConflict(
    conflict: { server_payload: any; server_updated_at: string },
    clientRecord: SyncPushRecord
  ): 'server_wins' | 'client_wins' {
    const clientTimestamp = clientRecord.client_timestamp;
    return clientTimestamp >= conflict.server_updated_at ? 'client_wins' : 'server_wins';
  }

  private async recordSyncMeta(record: SyncPushRecord, client_id: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sync_meta (table_name, record_id, operation, payload, client_id, client_timestamp, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(
        record.table_name,
        record.record_id,
        record.operation,
        JSON.stringify(record.payload),
        client_id,
        record.client_timestamp
      )
      .run();
  }

  private async getChangesFromTable(
    tableName: string,
    since?: string,
    limit = 500
  ): Promise<SyncPullResult['records']> {
    const records: SyncPullResult['records'] = [];

    let query = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (since) {
      const timestampCol = this.getTimestampColumn(tableName);
      query += ` WHERE ${timestampCol} > ?`;
      params.push(since);
    }

    query += ` ORDER BY rowid ASC LIMIT ?`;
    params.push(limit);

    const result = await this.db.prepare(query).bind(...params).all();

    for (const row of result.results || []) {
      const payload = { ...row };
      delete (payload as any).rowid;

      records.push({
        table_name: tableName,
        record_id: (row as any).id || String((row as any).rowid),
        operation: 'INSERT',
        payload,
        server_timestamp: (row as any).updated_at || (row as any).created_at || new Date().toISOString(),
      });
    }

    return records;
  }

  private getTimestampColumn(tableName: string): string {
    const columns: Record<string, string> = {
      service_records: 'updated_at',
      clients: 'id',
      technicians: 'id',
      inventory_stock: 'item_code',
      inventory_items: 'installed_date',
      expenses: 'created_at',
      invoices: 'created_at',
      cash_transactions: 'created_at',
      attendance_log: 'clock_in',
    };
    return columns[tableName] || 'rowid';
  }
}
