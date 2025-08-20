#!/bin/bash

# Update all tool files to use the vscode adapter instead of direct vscode imports

echo "Updating imports in all tool files..."

# Find all TypeScript files in tools directory (excluding index.ts and types.ts)
find src/tools -name "*.ts" -not -name "index.ts" -not -name "types.ts" | while read file; do
  echo "Processing $file..."
  
  # Replace vscode imports with adapter import
  sed -i '' "s|import \* as vscode from 'vscode'|import { vscode } from '../../vscode-adapter'|g" "$file"
  sed -i '' "s|import { .* } from 'vscode'|import { vscode } from '../../vscode-adapter'|g" "$file"
  
  # Handle Uri imports specially
  sed -i '' "s|import { Uri } from 'vscode'|import { vscode, Uri } from '../../vscode-adapter'|g" "$file"
  
  # Update relative paths for adapter (for files in subdirectories)
  if [[ "$file" == *"/lsp/"* ]] || [[ "$file" == *"/cdp/"* ]] || [[ "$file" == *"/helper/"* ]] || [[ "$file" == *"/system/"* ]]; then
    sed -i '' "s|from '../../vscode-adapter'|from '../../../vscode-adapter'|g" "$file"
  fi
done

echo "Import updates complete!"