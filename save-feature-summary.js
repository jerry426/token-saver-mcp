#!/usr/bin/env node

fetch('http://127.0.0.1:9700/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'write_memory',
      arguments: {
        key: 'feature:verbosity_system',
        value: {
          status: 'COMPLETE',
          implementation: {
            database_changes: [
              'Added importance column (1-5 scale)',
              'Added verbosity column (1-4 scale)',
              'Added migration for existing databases',
              'Added indexes for performance',
            ],
            enums_added: [
              'VerbosityLevel (MINIMAL, STANDARD, DETAILED, COMPREHENSIVE)',
              'ImportanceLevel (TRIVIAL, LOW, STANDARD, HIGH, CRITICAL)',
            ],
            tools_updated: [
              'write_memory - accepts importance and verbosity parameters',
              'smart_resume - filters by verbosity and minImportance',
            ],
            new_method: 'readFiltered() for selective memory retrieval',
          },
          benefits: [
            'Control over context verbosity',
            'Filter out conversational cruft',
            'Preserve only critical information',
            'Adaptive context based on needs',
          ],
          tested: true,
        },
        scope: 'project',
        importance: 4,
        verbosity: 2,
      },
    },
    id: 1,
  }),
})
  .then(r => r.json())
  .then(r => console.log('Feature summary saved:', JSON.stringify(r.result || r.error, null, 2)))
  .catch(console.error)
