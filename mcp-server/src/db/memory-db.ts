import * as fs from 'node:fs'
import * as path from 'node:path'
import Database from 'better-sqlite3'
import { jsonToMarkdown } from '../utils/json-to-markdown'

// Types
export interface Memory {
  id: string
  key: string
  value: string // JSON string
  markdown?: string // Human-readable markdown representation
  scope: MemoryScope
  project_path?: string
  session_id?: string
  created_at: string
  updated_at: string
  accessed_at: string
  created_by?: string
  ttl?: number
  tags?: string // JSON array
  access_count: number
  importance?: number // 1-5 scale: 1=trivial, 3=standard, 5=critical
  verbosity?: number // 1-4: minimal, standard, detailed, comprehensive
}

export enum MemoryScope {
  GLOBAL = 'global',
  PROJECT = 'project',
  SESSION = 'session',
  SHARED = 'shared',
}

export enum VerbosityLevel {
  MINIMAL = 1, // Just critical project state
  STANDARD = 2, // + key decisions and rationale
  DETAILED = 3, // + implementation details
  COMPREHENSIVE = 4, // + conversation context and examples
}

export enum ImportanceLevel {
  TRIVIAL = 1, // Nice to have, can be dropped
  LOW = 2, // Helpful but not essential
  STANDARD = 3, // Normal importance (default)
  HIGH = 4, // Important to preserve
  CRITICAL = 5, // Must never be lost
}

class MemoryDatabase {
  private db: Database.Database
  private dbPath: string

  constructor() {
    // Store database in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.'
    const tokenSaverDir = path.join(homeDir, '.token-saver-mcp')

    // Create directory if it doesn't exist
    if (!fs.existsSync(tokenSaverDir)) {
      fs.mkdirSync(tokenSaverDir, { recursive: true })
    }

    this.dbPath = path.join(tokenSaverDir, 'memory.db')
    this.db = new Database(this.dbPath)

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    this.initDatabase()
  }

  private checkNeedsMigration(): boolean {
    try {
      // Check if memories table exists
      const tableInfo = this.db.prepare('PRAGMA table_info(memories)').all()
      if (tableInfo.length === 0)
        return false // No table, will create new one

      // Check if value_text column exists (we need to migrate to remove it)
      const hasValueText = tableInfo.some((col: any) => col.name === 'value_text')
      // Check if markdown column is missing (need to add it)
      const hasMarkdown = tableInfo.some((col: any) => col.name === 'markdown')

      return hasValueText || !hasMarkdown // Need migration if value_text EXISTS or markdown is MISSING
    }
    catch {
      return false // No table exists yet
    }
  }

  private migrateToJsonSchema() {
    console.log('[MemoryDB] Migrating schema...')

    // Check current schema
    const tableInfo = this.db.prepare('PRAGMA table_info(memories)').all()
    const hasMarkdown = tableInfo.some((col: any) => col.name === 'markdown')
    const hasValueText = tableInfo.some((col: any) => col.name === 'value_text')

    if (!hasMarkdown) {
      // Just add markdown column if it doesn't exist
      console.log('[MemoryDB] Adding markdown column...')
      this.db.exec('ALTER TABLE memories ADD COLUMN markdown TEXT')

      // Generate markdown for existing memories
      const memories = this.db.prepare('SELECT id, value FROM memories').all() as Array<{ id: string, value: string }>
      const updateStmt = this.db.prepare('UPDATE memories SET markdown = ? WHERE id = ?')

      for (const memory of memories) {
        try {
          const jsonValue = JSON.parse(memory.value)
          const markdown = jsonToMarkdown(jsonValue)
          updateStmt.run(markdown, memory.id)
        }
        catch (err) {
          console.error(`[MemoryDB] Failed to generate markdown for memory ${memory.id}:`, err)
        }
      }

      console.log(`[MemoryDB] Generated markdown for ${memories.length} existing memories`)
    }

    if (hasValueText) {
      // Also need to remove value_text column (legacy migration)
      console.log('[MemoryDB] Removing legacy value_text column...')

      // Create new table without value_text but with markdown
      this.db.exec(`
        CREATE TABLE memories_new (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value JSON NOT NULL,
          markdown TEXT,
          scope TEXT NOT NULL DEFAULT 'project',
          project_path TEXT,
          session_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          accessed_at TEXT DEFAULT (datetime('now')),
          created_by TEXT,
          ttl INTEGER,
          tags TEXT,
          access_count INTEGER DEFAULT 0,
          importance INTEGER DEFAULT 3,
          verbosity INTEGER DEFAULT 2
        )
      `)

      // Copy data from old table
      this.db.exec(`
        INSERT INTO memories_new 
        SELECT 
          id, key, 
          json(value), -- Convert TEXT to JSON type
          NULL, -- markdown will be generated
          scope, project_path, session_id,
          created_at, updated_at, accessed_at,
          created_by, ttl, tags, access_count,
          importance, verbosity
        FROM memories
      `)

      // Generate markdown for all memories
      const memories = this.db.prepare('SELECT id, value FROM memories_new').all() as Array<{ id: string, value: string }>
      const updateStmt = this.db.prepare('UPDATE memories_new SET markdown = ? WHERE id = ?')

      for (const memory of memories) {
        try {
          const jsonValue = JSON.parse(memory.value)
          const markdown = jsonToMarkdown(jsonValue)
          updateStmt.run(markdown, memory.id)
        }
        catch (err) {
          console.error(`[MemoryDB] Failed to generate markdown for memory ${memory.id}:`, err)
        }
      }

      // Drop old table and rename new one
      this.db.exec(`
        DROP TABLE memories;
        ALTER TABLE memories_new RENAME TO memories;
      `)
    }

    console.log('[MemoryDB] Migration complete!')
  }

  private initDatabase() {
    // Check if we need to migrate from TEXT to JSON type
    const needsMigration = this.checkNeedsMigration()

    if (needsMigration) {
      this.migrateToJsonSchema()
    }
    else {
      // Create memories table with clean JSON type
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value JSON NOT NULL,
          markdown TEXT,
          scope TEXT NOT NULL DEFAULT 'project',
          project_path TEXT,
          session_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          accessed_at TEXT DEFAULT (datetime('now')),
          created_by TEXT,
          ttl INTEGER,
          tags TEXT,
          access_count INTEGER DEFAULT 0,
          importance INTEGER DEFAULT 3,
          verbosity INTEGER DEFAULT 2
        )
      `)
    }

    // Add columns to existing tables (migration) - do this first!
    try {
      this.db.exec(`ALTER TABLE memories ADD COLUMN importance INTEGER DEFAULT 3`)
    }
    catch {} // Column may already exist

    try {
      this.db.exec(`ALTER TABLE memories ADD COLUMN verbosity INTEGER DEFAULT 2`)
    }
    catch {} // Column may already exist

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_key ON memories(key);
      CREATE INDEX IF NOT EXISTS idx_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_project ON memories(project_path);
      CREATE INDEX IF NOT EXISTS idx_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_scope_project ON memories(scope, project_path);
      CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_verbosity ON memories(verbosity);
    `)

    // Create FTS5 virtual table for full-text search
    this.initFTS()

    // Create trigger to update updated_at
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON memories
      FOR EACH ROW
      BEGIN
        UPDATE memories SET updated_at = datetime('now')
        WHERE id = NEW.id;
      END;
    `)

    console.error(`[MemoryDB] Initialized database at ${this.dbPath}`)
  }

  private initFTS() {
    try {
      // Drop old FTS table if it exists (for migration)
      try {
        this.db.exec(`DROP TABLE IF EXISTS memories_fts`)
      }
      catch {}

      // Create FTS5 virtual table using key, value, and markdown columns
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts 
        USING fts5(key, value, markdown, content='memories', content_rowid='rowid')
      `)

      // Populate FTS table with existing data
      const existingCount = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }
      const ftsCount = this.db.prepare('SELECT COUNT(*) as count FROM memories_fts').pluck().get() as number || 0

      if (existingCount.count > 0 && ftsCount === 0) {
        // Initial population using key, value, and markdown columns
        this.db.exec(`
          INSERT INTO memories_fts(rowid, key, value, markdown) 
          SELECT rowid, key, value, markdown FROM memories
        `)
      }

      // Create triggers to keep FTS in sync
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS memories_ai 
        AFTER INSERT ON memories 
        BEGIN
          INSERT INTO memories_fts(rowid, key, value, markdown) 
          VALUES (new.rowid, new.key, new.value, new.markdown);
        END;

        CREATE TRIGGER IF NOT EXISTS memories_ad 
        AFTER DELETE ON memories 
        BEGIN
          DELETE FROM memories_fts WHERE rowid = old.rowid;
        END;

        CREATE TRIGGER IF NOT EXISTS memories_au 
        AFTER UPDATE ON memories 
        BEGIN
          UPDATE memories_fts 
          SET key = new.key, value = new.value, markdown = new.markdown 
          WHERE rowid = new.rowid;
        END;
      `)

      console.error('[MemoryDB] FTS5 search initialized')
    }
    catch (error: any) {
      // FTS5 might not be available in some SQLite builds
      console.warn('[MemoryDB] FTS5 initialization failed (search will be unavailable):', error.message)
    }
  }

  // Write a memory
  write(params: {
    key: string
    value: any
    scope?: MemoryScope
    project_path?: string
    session_id?: string
    created_by?: string
    ttl?: number
    tags?: string[]
    importance?: number // 1-5 scale
    verbosity?: number // 1-4 scale
  }): Memory {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const scope = params.scope || MemoryScope.PROJECT
    // For JSON type column, we pass the value directly (SQLite will handle JSON conversion)
    const valueJson = typeof params.value === 'string' ? params.value : JSON.stringify(params.value)
    const tagsJson = params.tags ? JSON.stringify(params.tags) : null

    // Generate markdown representation
    const parsedValue = typeof params.value === 'string' ? JSON.parse(params.value) : params.value
    const markdown = jsonToMarkdown(parsedValue, params.key)

    // Check if memory exists
    const existing = this.db.prepare(`
      SELECT * FROM memories 
      WHERE key = ? AND scope = ? 
      AND (project_path = ? OR (project_path IS NULL AND ? IS NULL))
    `).get(params.key, scope, params.project_path, params.project_path) as Memory | undefined

    if (existing) {
      // Update existing memory
      this.db.prepare(`
        UPDATE memories 
        SET value = ?, markdown = ?, updated_at = datetime('now'), accessed_at = datetime('now'),
            access_count = access_count + 1, ttl = ?, tags = ?, 
            importance = ?, verbosity = ?
        WHERE id = ?
      `).run(
        valueJson,
        markdown,
        params.ttl,
        tagsJson,
        params.importance ?? ImportanceLevel.STANDARD,
        params.verbosity ?? VerbosityLevel.STANDARD,
        existing.id,
      )

      return this.read({ key: params.key, scope, project_path: params.project_path }) as Memory
    }
    else {
      // Insert new memory
      this.db.prepare(`
        INSERT INTO memories (id, key, value, markdown, scope, project_path, session_id, created_by, ttl, tags, importance, verbosity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.key,
        valueJson,
        markdown,
        scope,
        params.project_path,
        params.session_id,
        params.created_by,
        params.ttl,
        tagsJson,
        params.importance ?? ImportanceLevel.STANDARD,
        params.verbosity ?? VerbosityLevel.STANDARD,
      )

      return this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Memory
    }
  }

  // Read a memory or memories by pattern
  read(params: {
    key?: string
    pattern?: string
    scope?: MemoryScope
    project_path?: string
    session_id?: string
  }): Memory | Memory[] | null {
    // Update access time and count
    const updateAccess = (id: string) => {
      this.db.prepare(`
        UPDATE memories 
        SET accessed_at = datetime('now'), access_count = access_count + 1
        WHERE id = ?
      `).run(id)
    }

    if (params.pattern || params.key?.includes('*')) {
      // Pattern matching - convert * to SQL LIKE pattern
      const pattern = (params.pattern || params.key || '').replace(/\*/g, '%')

      let query = 'SELECT * FROM memories WHERE key LIKE ?'
      const queryParams: any[] = [pattern]

      if (params.scope) {
        query += ' AND scope = ?'
        queryParams.push(params.scope)
      }

      if (params.project_path) {
        query += ' AND project_path = ?'
        queryParams.push(params.project_path)
      }

      const results = this.db.prepare(query).all(...queryParams) as Memory[]

      // Update access for all results
      results.forEach(r => updateAccess(r.id))

      return results
    }
    else if (params.key) {
      // Exact key match
      let query = 'SELECT * FROM memories WHERE key = ?'
      const queryParams: any[] = [params.key]

      if (params.scope) {
        query += ' AND scope = ?'
        queryParams.push(params.scope)
      }

      if (params.project_path) {
        query += ' AND project_path = ?'
        queryParams.push(params.project_path)
      }

      const result = this.db.prepare(query).get(...queryParams) as Memory | undefined

      if (result) {
        updateAccess(result.id)
      }

      return result || null
    }

    return null
  }

  // Read memories with verbosity and importance filtering
  readFiltered(params: {
    key?: string
    pattern?: string
    scope?: MemoryScope
    project_path?: string
    session_id?: string
    minVerbosity?: number // Only return memories at or below this verbosity level
    minImportance?: number // Only return memories at or above this importance level
    daysAgo?: number // Only return memories updated in last N days
    since?: string // ISO date string - only return memories updated after this date
    until?: string // ISO date string - only return memories updated before this date
  }): Memory[] {
    try {
      let query = 'SELECT * FROM memories WHERE 1=1'
      const queryParams: any[] = []

      if (params.pattern || params.key?.includes('*')) {
        const pattern = (params.pattern || params.key || '').replace(/\*/g, '%')
        query += ' AND key LIKE ?'
        queryParams.push(pattern)
      }
      else if (params.key) {
        query += ' AND key = ?'
        queryParams.push(params.key)
      }

      if (params.scope) {
        query += ' AND scope = ?'
        queryParams.push(params.scope)
      }

      if (params.project_path) {
        query += ' AND (project_path = ? OR project_path IS NULL)'
        queryParams.push(params.project_path)
      }

      // Apply verbosity filter
      if (params.minVerbosity !== undefined) {
        query += ' AND verbosity <= ?'
        queryParams.push(params.minVerbosity)
      }

      // Apply importance filter
      if (params.minImportance !== undefined) {
        query += ' AND importance >= ?'
        queryParams.push(params.minImportance)
      }

      // Apply date filters
      if (params.daysAgo !== undefined) {
        query += ' AND updated_at >= datetime(\'now\', ?)'
        queryParams.push(`-${params.daysAgo} days`)
      }

      if (params.since) {
        query += ' AND updated_at >= ?'
        queryParams.push(params.since)
      }

      if (params.until) {
        query += ' AND updated_at <= ?'
        queryParams.push(params.until)
      }

      query += ' ORDER BY importance DESC, updated_at DESC'

      const results = this.db.prepare(query).all(...queryParams) as Memory[]

      // Update access for all results
      results.forEach((r) => {
        this.db.prepare(`
          UPDATE memories 
          SET accessed_at = datetime('now'), access_count = access_count + 1
          WHERE id = ?
        `).run(r.id)
      })

      return results
    }
    catch (error: any) {
      // Handle database corruption gracefully
      if (error.message?.includes('database disk image is malformed')) {
        console.error('[MemoryDB] Database corruption detected in readFiltered')
        try {
          // Try to rebuild FTS
          this.db.exec('DROP TABLE IF EXISTS memories_fts')
          this.initFTS()
          console.error('[MemoryDB] FTS rebuilt, retrying query...')
          // Return empty array for now
          return []
        }
        catch (rebuildError) {
          console.error('[MemoryDB] Failed to rebuild FTS:', rebuildError)
          return []
        }
      }
      throw error
    }
  }

  // List memories
  list(params: {
    scope?: MemoryScope
    project_path?: string
    session_id?: string
    tags?: string[]
    limit?: number
  } = {}): Memory[] {
    let query = 'SELECT * FROM memories WHERE 1=1'
    const queryParams: any[] = []

    if (params.scope) {
      query += ' AND scope = ?'
      queryParams.push(params.scope)
    }

    if (params.project_path) {
      query += ' AND project_path = ?'
      queryParams.push(params.project_path)
    }

    if (params.session_id) {
      query += ' AND session_id = ?'
      queryParams.push(params.session_id)
    }

    query += ' ORDER BY accessed_at DESC'

    if (params.limit) {
      query += ' LIMIT ?'
      queryParams.push(params.limit)
    }

    return this.db.prepare(query).all(...queryParams) as Memory[]
  }

  // Delete a memory
  delete(params: {
    key: string
    scope?: MemoryScope
    project_path?: string
  }): boolean {
    let query = 'DELETE FROM memories WHERE key = ?'
    const queryParams: any[] = [params.key]

    if (params.scope) {
      query += ' AND scope = ?'
      queryParams.push(params.scope)
    }

    if (params.project_path) {
      query += ' AND project_path = ?'
      queryParams.push(params.project_path)
    }

    const result = this.db.prepare(query).run(...queryParams)
    return result.changes > 0
  }

  // Delete memories by pattern
  deletePattern(params: {
    pattern: string
    scope?: MemoryScope
    project_path?: string
  }): number {
    // Convert wildcard pattern to SQL LIKE pattern
    const sqlPattern = params.pattern.replace(/\*/g, '%')

    let query = 'DELETE FROM memories WHERE key LIKE ?'
    const queryParams: any[] = [sqlPattern]

    if (params.scope) {
      query += ' AND scope = ?'
      queryParams.push(params.scope)
    }

    if (params.project_path) {
      query += ' AND project_path = ?'
      queryParams.push(params.project_path)
    }

    const result = this.db.prepare(query).run(...queryParams)
    return result.changes
  }

  // Full-text search memories
  searchMemories(params: {
    query: string
    scope?: MemoryScope
    project_path?: string
    minImportance?: number
    maxVerbosity?: number
    limit?: number
  }): Memory[] {
    try {
      // Build the SQL query
      let sql = `
        SELECT m.*, -fts.rank as rank
        FROM memories m
        JOIN memories_fts fts ON m.rowid = fts.rowid
        WHERE fts MATCH ?
      `
      const queryParams: any[] = [params.query]

      if (params.scope) {
        sql += ' AND m.scope = ?'
        queryParams.push(params.scope)
      }

      if (params.project_path) {
        sql += ' AND m.project_path = ?'
        queryParams.push(params.project_path)
      }

      if (params.minImportance) {
        sql += ' AND m.importance >= ?'
        queryParams.push(params.minImportance)
      }

      if (params.maxVerbosity) {
        sql += ' AND m.verbosity <= ?'
        queryParams.push(params.maxVerbosity)
      }

      sql += ' ORDER BY rank LIMIT ?'
      queryParams.push(params.limit || 50)

      const results = this.db.prepare(sql).all(...queryParams) as Memory[]

      // Update access count and timestamp
      for (const memory of results) {
        this.db.prepare(`
          UPDATE memories 
          SET access_count = access_count + 1,
              accessed_at = datetime('now')
          WHERE id = ?
        `).run(memory.id)
      }

      return results
    }
    catch (error: any) {
      // If FTS is not available, fall back to LIKE search
      console.warn('[MemoryDB] FTS search failed, falling back to LIKE search:', error.message)

      const likePattern = `%${params.query}%`
      let sql = `
        SELECT * FROM memories
        WHERE (key LIKE ? OR value LIKE ?)
      `
      const queryParams: any[] = [likePattern, likePattern]

      if (params.scope) {
        sql += ' AND scope = ?'
        queryParams.push(params.scope)
      }

      if (params.project_path) {
        sql += ' AND project_path = ?'
        queryParams.push(params.project_path)
      }

      if (params.minImportance) {
        sql += ' AND importance >= ?'
        queryParams.push(params.minImportance)
      }

      if (params.maxVerbosity) {
        sql += ' AND verbosity <= ?'
        queryParams.push(params.maxVerbosity)
      }

      sql += ' ORDER BY updated_at DESC LIMIT ?'
      queryParams.push(params.limit || 50)

      return this.db.prepare(sql).all(...queryParams) as Memory[]
    }
  }

  // Clean expired memories
  cleanExpired(): number {
    const result = this.db.prepare(`
      DELETE FROM memories 
      WHERE ttl IS NOT NULL 
      AND datetime('now') > datetime(created_at, '+' || ttl || ' seconds')
    `).run()

    return result.changes
  }

  // Get database stats
  getStats(): {
    total_memories: number
    by_scope: Record<string, number>
    database_size: number
  } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }

    const byScope = this.db.prepare(`
      SELECT scope, COUNT(*) as count 
      FROM memories 
      GROUP BY scope
    `).all() as Array<{ scope: string, count: number }>

    const scopeMap: Record<string, number> = {}
    byScope.forEach((s) => {
      scopeMap[s.scope] = s.count
    })

    // Get database file size
    const stats = fs.statSync(this.dbPath)

    return {
      total_memories: total.count,
      by_scope: scopeMap,
      database_size: stats.size,
    }
  }

  close() {
    this.db.close()
  }
}

// Export singleton instance
export const memoryDb = new MemoryDatabase()
