/**
 * SQL Validator — Prevents injection attacks on AI-generated SQL queries
 */

// Allowed tables for copilot queries — prevents access to sensitive tables
export const ALLOWED_TABLES = [
  'technicians',
  'clients',
  'service_records',
  'attendance',
  'invoices',
  'inventory',
  'expenses',
  'system_config',
];

/**
 * Validate generated SQL to prevent injection attacks.
 * Returns null if valid, or an error message string if blocked.
 */
export function validateSql(sql: string): string | null {
  const normalized = sql.trim().toUpperCase();

  // Only allow SELECT statements
  if (!normalized.startsWith('SELECT')) {
    return 'Only SELECT queries are allowed';
  }

  // Block dangerous keywords
  const blocked = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'CREATE',
    'TRUNCATE',
    'EXEC',
    'EXECUTE',
    'PRAGMA',
    'ATTACH',
    'DETACH',
    'REPLACE',
    'UNION',
  ];
  for (const keyword of blocked) {
    if (normalized.includes(keyword)) {
      return `Blocked keyword: ${keyword}`;
    }
  }

  // Block semicolons (no multiple statements)
  if (sql.includes(';')) {
    return 'Multiple statements not allowed';
  }

  // Block comments
  if (sql.includes('--') || sql.includes('/*')) {
    return 'SQL comments not allowed';
  }

  // Verify only allowed tables are accessed via FROM
  const fromMatch = normalized.match(/FROM\s+(\w+)/g);
  if (fromMatch) {
    for (const match of fromMatch) {
      const table = match.replace(/FROM\s+/i, '').trim();
      if (!ALLOWED_TABLES.includes(table.toLowerCase())) {
        return `Table '${table}' is not accessible`;
      }
    }
  }

  // Verify only allowed tables are accessed via JOIN
  const joinMatch = normalized.match(/JOIN\s+(\w+)/g);
  if (joinMatch) {
    for (const match of joinMatch) {
      const table = match.replace(/JOIN\s+/i, '').trim();
      if (!ALLOWED_TABLES.includes(table.toLowerCase())) {
        return `Table '${table}' is not accessible`;
      }
    }
  }

  return null;
}
