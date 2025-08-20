#!/bin/bash

echo "Fixing LSP tool implementations..."

# For each LSP tool, add the import and implementation
for file in src/tools/lsp/*.ts; do
  name=$(basename "$file" .ts)
  echo "Processing $name..."
  
  # Convert kebab-case to camelCase for function names
  funcName=$(echo "$name" | sed 's/-\([a-z]\)/\U\1/g')
  
  # Check if function is already defined
  if ! grep -q "async function $funcName" "$file"; then
    # Add import at the top
    sed -i '' "1a\\
import { $funcName } from '../lsp-implementations'\\
" "$file"
    
    # Add default export at the end
    echo "
// Default export for tool handler
export default async function(args: any) {
  return $funcName(args.uri, args.line, args.character, args.newName, args.direction)
}" >> "$file"
  fi
done

# Special cases
echo "Fixing special cases..."

# get-document-symbols only needs uri
sed -i '' 's/getDocumentSymbols(args.uri, args.line, args.character, args.newName, args.direction)/getDocumentSymbols(args.uri)/g' src/tools/lsp/get-document-symbols.ts

# get-diagnostics is optional uri
sed -i '' 's/getDiagnostics(args.uri, args.line, args.character, args.newName, args.direction)/getDiagnostics(args.uri)/g' src/tools/lsp/get-diagnostics.ts

# search-text uses query
sed -i '' 's/searchText(args.uri, args.line, args.character, args.newName, args.direction)/searchText(args.query, args)/g' src/tools/lsp/search-text.ts

# rename-symbol uses newName
sed -i '' 's/renameSymbol(args.uri, args.line, args.character, args.newName, args.direction)/renameSymbol(args.uri, args.line, args.character, args.newName)/g' src/tools/lsp/rename-symbol.ts

# get-call-hierarchy uses direction
sed -i '' 's/getCallHierarchy(args.uri, args.line, args.character, args.newName, args.direction)/getCallHierarchy(args.uri, args.line, args.character, args.direction)/g' src/tools/lsp/get-call-hierarchy.ts

echo "LSP tools fixed!"