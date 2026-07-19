import { describe, expect, it } from 'vitest';
import { validateSql, ALLOWED_TABLES } from '../modules/utils/sql-validator';

describe('SQL Injection Protection', () => {
  describe('validateSql - Non-SELECT Statements (blocked first)', () => {
    it('blocks DROP as first word', () => {
      expect(validateSql('DROP TABLE technicians')).toBe('Only SELECT queries are allowed');
    });

    it('blocks INSERT as first word', () => {
      expect(validateSql('INSERT INTO technicians VALUES (1)')).toBe(
        'Only SELECT queries are allowed'
      );
    });

    it('blocks UPDATE as first word', () => {
      expect(validateSql('UPDATE clients SET name = "hacked"')).toBe(
        'Only SELECT queries are allowed'
      );
    });

    it('blocks DELETE as first word', () => {
      expect(validateSql('DELETE FROM technicians')).toBe('Only SELECT queries are allowed');
    });

    it('blocks ALTER as first word', () => {
      expect(validateSql('ALTER TABLE technicians ADD COLUMN hacked TEXT')).toBe(
        'Only SELECT queries are allowed'
      );
    });

    it('blocks CREATE as first word', () => {
      expect(validateSql('CREATE TABLE hacked (id INT)')).toBe('Only SELECT queries are allowed');
    });

    it('blocks TRUNCATE as first word', () => {
      expect(validateSql('TRUNCATE TABLE service_records')).toBe('Only SELECT queries are allowed');
    });

    it('blocks EXEC as first word', () => {
      expect(validateSql('EXEC xp_cmdshell("rm -rf /")')).toBe('Only SELECT queries are allowed');
    });

    it('blocks PRAGMA as first word', () => {
      expect(validateSql('PRAGMA table_info(technicians)')).toBe('Only SELECT queries are allowed');
    });
  });

  describe('validateSql - Dangerous Keywords in SELECT', () => {
    it('blocks DROP inside SELECT', () => {
      expect(validateSql("SELECT * FROM clients WHERE name = 'DROP TABLE x'")).toBe(
        'Blocked keyword: DROP'
      );
    });

    it('blocks INSERT inside SELECT', () => {
      expect(validateSql("SELECT * FROM clients WHERE name = 'INSERT INTO x'")).toBe(
        'Blocked keyword: INSERT'
      );
    });

    it('blocks UPDATE inside SELECT', () => {
      expect(validateSql("SELECT * FROM clients WHERE name = 'UPDATE x'")).toBe(
        'Blocked keyword: UPDATE'
      );
    });

    it('blocks DELETE inside SELECT', () => {
      expect(validateSql("SELECT * FROM clients WHERE name = 'DELETE FROM x'")).toBe(
        'Blocked keyword: DELETE'
      );
    });
  });

  describe('validateSql - UNION Attacks', () => {
    it('blocks UNION SELECT', () => {
      expect(validateSql('SELECT * FROM technicians UNION SELECT * FROM clients')).toBe(
        'Blocked keyword: UNION'
      );
    });

    it('blocks UNION with string concat', () => {
      expect(validateSql('SELECT id FROM technicians UNION SELECT password FROM users')).toBe(
        'Blocked keyword: UNION'
      );
    });
  });

  describe('validateSql - Multiple Statements', () => {
    it('blocks semicolons with DROP', () => {
      // DROP is caught first because it's in the blocked keywords list
      expect(validateSql('SELECT * FROM clients; DROP TABLE technicians')).toBe(
        'Blocked keyword: DROP'
      );
    });

    it('blocks semicolons with non-keyword', () => {
      expect(validateSql('SELECT * FROM clients; SELECT * FROM technicians')).toBe(
        'Multiple statements not allowed'
      );
    });
  });

  describe('validateSql - SQL Comments', () => {
    it('blocks double-dash comments', () => {
      expect(validateSql('SELECT * FROM clients -- ignore this')).toBe('SQL comments not allowed');
    });

    it('blocks block comments', () => {
      expect(validateSql('SELECT * FROM clients /* hack */')).toBe('SQL comments not allowed');
    });
  });

  describe('validateSql - Table Access Control', () => {
    it('allows queries on allowed tables', () => {
      expect(validateSql('SELECT * FROM technicians')).toBeNull();
      expect(validateSql('SELECT * FROM clients')).toBeNull();
      expect(validateSql('SELECT * FROM service_records')).toBeNull();
      expect(validateSql('SELECT * FROM attendance')).toBeNull();
      expect(validateSql('SELECT * FROM invoices')).toBeNull();
      expect(validateSql('SELECT * FROM inventory')).toBeNull();
      expect(validateSql('SELECT * FROM expenses')).toBeNull();
      expect(validateSql('SELECT * FROM system_config')).toBeNull();
    });

    it('blocks access to sqlite_master', () => {
      expect(validateSql('SELECT * FROM sqlite_master')).toBe(
        "Table 'SQLITE_MASTER' is not accessible"
      );
    });

    it('blocks access to internal tables', () => {
      expect(validateSql('SELECT * FROM users')).toBe("Table 'USERS' is not accessible");
    });

    it('blocks access to passwords table', () => {
      expect(validateSql('SELECT * FROM passwords')).toBe("Table 'PASSWORDS' is not accessible");
    });

    it('blocks access to secrets table', () => {
      expect(validateSql('SELECT * FROM secrets')).toBe("Table 'SECRETS' is not accessible");
    });

    it('blocks JOIN on disallowed table', () => {
      expect(validateSql('SELECT * FROM clients JOIN passwords ON 1=1')).toBe(
        "Table 'PASSWORDS' is not accessible"
      );
    });

    it('allows JOIN on allowed tables', () => {
      expect(
        validateSql('SELECT * FROM clients c JOIN service_records s ON c.id = s.client_id')
      ).toBeNull();
    });
  });

  describe('validateSql - Complex Injection Attempts', () => {
    it('allows OR-based injection (still valid SELECT)', () => {
      // This is a valid SELECT - the injection protection is at the API layer
      expect(validateSql("SELECT * FROM technicians WHERE name = 'admin' OR 1=1")).toBeNull();
    });

    it('blocks stacked queries with multiple attacks', () => {
      // DROP is caught first
      expect(validateSql('SELECT * FROM clients; DROP TABLE technicians')).toBe(
        'Blocked keyword: DROP'
      );
    });

    it('blocks comment bypass attempt', () => {
      // UNION is caught before comments
      expect(validateSql('SELECT * FROM clients/**/UNION SELECT * FROM technicians')).toBe(
        'Blocked keyword: UNION'
      );
    });
  });

  describe('validateSql - Valid Queries', () => {
    it('allows simple SELECT', () => {
      expect(validateSql('SELECT * FROM technicians')).toBeNull();
    });

    it('allows SELECT with WHERE', () => {
      expect(validateSql("SELECT * FROM clients WHERE name LIKE '%Myanmar%'")).toBeNull();
    });

    it('allows SELECT with JOIN', () => {
      expect(
        validateSql(
          'SELECT t.name, c.company_name FROM technicians t JOIN clients c ON t.id = c.technician_id'
        )
      ).toBeNull();
    });

    it('allows SELECT with GROUP BY', () => {
      expect(
        validateSql('SELECT status, COUNT(*) as count FROM service_records GROUP BY status')
      ).toBeNull();
    });

    it('allows SELECT with ORDER BY', () => {
      expect(validateSql('SELECT * FROM attendance ORDER BY clock_in DESC LIMIT 10')).toBeNull();
    });

    it('allows SELECT with aggregate functions', () => {
      expect(validateSql('SELECT SUM(amount) as total FROM expenses')).toBeNull();
    });

    it('allows SELECT with subquery on allowed tables', () => {
      expect(
        validateSql(
          'SELECT * FROM technicians WHERE id IN (SELECT technician_id FROM service_records)'
        )
      ).toBeNull();
    });
  });

  describe('ALLOWED_TABLES', () => {
    it('contains expected tables', () => {
      expect(ALLOWED_TABLES).toContain('technicians');
      expect(ALLOWED_TABLES).toContain('clients');
      expect(ALLOWED_TABLES).toContain('service_records');
      expect(ALLOWED_TABLES).toContain('attendance');
      expect(ALLOWED_TABLES).toContain('invoices');
      expect(ALLOWED_TABLES).toContain('inventory');
      expect(ALLOWED_TABLES).toContain('expenses');
      expect(ALLOWED_TABLES).toContain('system_config');
    });

    it('does not contain sensitive tables', () => {
      expect(ALLOWED_TABLES).not.toContain('users');
      expect(ALLOWED_TABLES).not.toContain('passwords');
      expect(ALLOWED_TABLES).not.toContain('secrets');
      expect(ALLOWED_TABLES).not.toContain('tokens');
    });
  });
});
