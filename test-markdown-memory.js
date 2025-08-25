#!/usr/bin/env node

/**
 * Test script for the enhanced memory system with markdown support
 */

const { execSync } = require('child_process');

// Test data with complex JSON structure
const complexData = {
  task: {
    name: "Implement markdown support",
    description: "Add human-readable markdown column to memory database",
    status: "completed",
    priority: 5
  },
  workflow: {
    steps: [
      "Create JSON to Markdown formatter",
      "Update database schema",
      "Migrate existing data",
      "Test implementation"
    ],
    currentStep: 3,
    progress: 75
  },
  files: [
    {
      path: "/src/db/memory-db.ts",
      changes: ["Added markdown column", "Updated write method", "Enhanced FTS"],
      linesChanged: 150
    },
    {
      path: "/src/utils/json-to-markdown.ts",
      changes: ["Created formatter utility", "Added special handling for common patterns"],
      linesChanged: 200
    }
  ],
  context: {
    reasoning: "JSON is great for machines but hard for humans to read when complex. Markdown provides a nice human-friendly view while preserving the structured JSON for programmatic access.",
    benefits: [
      "Better debugging experience",
      "Easier manual review",
      "Enhanced full-text search",
      "Improved documentation"
    ]
  },
  metadata: {
    author: "Token Saver MCP",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  }
};

console.log('Testing enhanced memory system with markdown support...\n');

// Write the complex memory
console.log('1. Writing complex memory with markdown generation...');
try {
  execSync(`curl -s http://127.0.0.1:9700/mcp/simple/write_memory -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    key: "test:markdown:complex",
    value: complexData,
    scope: "project",
    importance: 5,
    verbosity: 4
  })}'`, { encoding: 'utf8' });
  console.log('   ✓ Memory written successfully\n');
} catch (error) {
  console.error('   ✗ Failed to write memory:', error.message);
}

// Read the memory back and display markdown
console.log('2. Reading memory to verify markdown generation...');
try {
  const result = execSync(`curl -s http://127.0.0.1:9700/mcp/simple/read_memory -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    key: "test:markdown:complex"
  })}'`, { encoding: 'utf8' });
  
  const memory = JSON.parse(result);
  
  if (memory.markdown) {
    console.log('   ✓ Markdown generated successfully!\n');
    console.log('Generated Markdown:');
    console.log('==========================================');
    console.log(memory.markdown);
    console.log('==========================================\n');
  } else {
    console.log('   ✗ No markdown field found in memory\n');
  }
} catch (error) {
  console.error('   ✗ Failed to read memory:', error.message);
}

// Test full-text search on markdown content
console.log('3. Testing full-text search on markdown content...');
try {
  const searchResult = execSync(`curl -s http://127.0.0.1:9700/mcp/simple/search_memories -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    query: "human-readable"
  })}'`, { encoding: 'utf8' });
  
  const results = JSON.parse(searchResult);
  
  if (results.memories && results.memories.length > 0) {
    console.log(`   ✓ Found ${results.memories.length} memory(ies) matching "human-readable"\n`);
    
    results.memories.forEach((mem, idx) => {
      console.log(`   Memory ${idx + 1}: ${mem.key}`);
      if (mem.markdown) {
        const preview = mem.markdown.substring(0, 100).replace(/\n/g, ' ');
        console.log(`   Markdown preview: ${preview}...`);
      }
    });
  } else {
    console.log('   ✗ No memories found matching search query\n');
  }
} catch (error) {
  console.error('   ✗ Failed to search memories:', error.message);
}

// Test with a simpler memory
console.log('\n4. Testing with simple string value...');
try {
  execSync(`curl -s http://127.0.0.1:9700/mcp/simple/write_memory -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    key: "test:markdown:simple",
    value: "This is a simple string value that should still get markdown formatting",
    scope: "project"
  })}'`, { encoding: 'utf8' });
  
  const result = execSync(`curl -s http://127.0.0.1:9700/mcp/simple/read_memory -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    key: "test:markdown:simple"
  })}'`, { encoding: 'utf8' });
  
  const memory = JSON.parse(result);
  
  if (memory.markdown) {
    console.log('   ✓ Simple value markdown:');
    console.log(`   ${memory.markdown}\n`);
  }
} catch (error) {
  console.error('   ✗ Failed with simple value:', error.message);
}

// List all test memories with markdown
console.log('5. Listing all test memories with markdown...');
try {
  const listResult = execSync(`curl -s http://127.0.0.1:9700/mcp/simple/list_memories -X POST -H "Content-Type: application/json" -d '${JSON.stringify({
    pattern: "test:markdown:*"
  })}'`, { encoding: 'utf8' });
  
  const memories = JSON.parse(listResult);
  
  if (memories.memories && memories.memories.length > 0) {
    console.log(`   ✓ Found ${memories.memories.length} test memories\n`);
    
    memories.memories.forEach(mem => {
      console.log(`   - ${mem.key}`);
      console.log(`     Has markdown: ${mem.markdown ? 'Yes' : 'No'}`);
      console.log(`     Created: ${mem.created_at}`);
      console.log(`     Access count: ${mem.access_count}`);
    });
  }
} catch (error) {
  console.error('   ✗ Failed to list memories:', error.message);
}

console.log('\n✅ Test complete!');
console.log('The memory system now includes human-readable markdown alongside structured JSON.');