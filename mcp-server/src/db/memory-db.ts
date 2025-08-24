import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

// Types
export interface Memory {
  id: string
  key: string
  value: string // JSON string
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
}

export enum MemoryScope {
  GLOBAL = 'global',
  PROJECT = 'project',
  SESSION = 'session',
  SHARED = 'shared'
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

  private initDatabase() {
    // Create memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'project',
        project_path TEXT,
        session_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        accessed_at TEXT DEFAULT (datetime('now')),
        created_by TEXT,
        ttl INTEGER,
        tags TEXT,
        access_count INTEGER DEFAULT 0
      )
    `)

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_key ON memories(key);
      CREATE INDEX IF NOT EXISTS idx_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_project ON memories(project_path);
      CREATE INDEX IF NOT EXISTS idx_session ON memories(session_id);
      CREATE INDEX IF NOT EXISTS idx_scope_project ON memories(scope, project_path);
    `)

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

    console.log(`[MemoryDB] Initialized database at ${this.dbPath}`)
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
  }): Memory {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const scope = params.scope || MemoryScope.PROJECT
    const valueJson = JSON.stringify(params.value)
    const tagsJson = params.tags ? JSON.stringify(params.tags) : null

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
        SET value = ?, updated_at = datetime('now'), accessed_at = datetime('now'),
            access_count = access_count + 1, ttl = ?, tags = ?
        WHERE id = ?
      `).run(valueJson, params.ttl, tagsJson, existing.id)

      return this.read({ key: params.key, scope, project_path: params.project_path })!
    } else {
      // Insert new memory
      this.db.prepare(`
        INSERT INTO memories (id, key, value, scope, project_path, session_id, created_by, ttl, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.key,
        valueJson,
        scope,
        params.project_path,
        params.session_id,
        params.created_by,
        params.ttl,
        tagsJson
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
    } else if (params.key) {
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
    `).all() as Array<{ scope: string; count: number }>

    const scopeMap: Record<string, number> = {}
    byScope.forEach(s => {
      scopeMap[s.scope] = s.count
    })

    // Get database file size
    const stats = fs.statSync(this.dbPath)

    return {
      total_memories: total.count,
      by_scope: scopeMap,
      database_size: stats.size
    }
  }

  close() {
    this.db.close()
  }
}

// Export singleton instance
export const memoryDb = new MemoryDatabase()