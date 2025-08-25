// Use built-in fetch in Node 18+

async function testExportImport() {
  console.log('Testing Memory Export/Import Tools\n')

  // Test export via MCP HTTP endpoint
  console.log('1. Testing export_memories...')

  try {
    const exportResponse = await fetch('http://127.0.0.1:9700/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'export_memories',
          arguments: {
            output: 'auto',
            minImportance: 3,
            pretty: true,
          },
        },
        id: 1,
      }),
    })

    const result = await exportResponse.json()

    if (result.error) {
      console.error('Export failed:', result.error)
    }
    else if (result.result && result.result.content) {
      console.log('Export successful!')
      console.log(result.result.content[0].text)

      // Extract file path from the response
      const filePathMatch = result.result.content[0].text.match(/📁 \*\*File\*\*: (.+)/)
      if (filePathMatch) {
        const exportedFile = filePathMatch[1]
        console.log('\n2. Testing import_memories with dry run...')

        // Test import with dry run
        const importResponse = await fetch('http://127.0.0.1:9700/mcp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: {
              name: 'import_memories',
              arguments: {
                file: exportedFile,
                dryRun: true,
                mode: 'merge',
              },
            },
            id: 2,
          }),
        })

        const importResult = await importResponse.json()

        if (importResult.error) {
          console.error('Import failed:', importResult.error)
        }
        else if (importResult.result && importResult.result.content) {
          console.log('Import dry run successful!')
          console.log(importResult.result.content[0].text)
        }
      }
    }
  }
  catch (error) {
    console.error('Test failed:', error)
  }
}

testExportImport()
