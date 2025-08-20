#!/bin/bash

echo "Fixing imports in all tool files..."

# Fix LSP tools
for file in src/tools/lsp/*.ts; do
  echo "Processing $file..."
  
  # Remove the import from '../../../lsp' and implement the function locally
  sed -i '' "/import.*from '\.\.\/\.\.\/\.\.\/lsp'/d" "$file"
  
  # Add vscode adapter import if not present
  if ! grep -q "vscode-adapter" "$file"; then
    sed -i '' "1i\\
import { vscode } from '../../../vscode-adapter'\\
" "$file"
  fi
done

# Fix CDP tools
for file in src/tools/cdp/*.ts; do
  echo "Processing $file..."
  
  # Remove cdp-bridge imports
  sed -i '' "/import.*from '\.\.\/\.\.\/cdp-bridge'/d" "$file"
  sed -i '' "/import.*from '\.\.\/\.\.\/\.\.\/cdp-bridge'/d" "$file"
  
  # Add vscode adapter import if not present
  if ! grep -q "vscode-adapter" "$file"; then
    sed -i '' "1i\\
import { vscode } from '../../../vscode-adapter'\\
" "$file"
  fi
done

# Fix Helper tools
for file in src/tools/helper/*.ts; do
  echo "Processing $file..."
  
  # Remove browser-helpers imports
  sed -i '' "/import.*from '\.\.\/\.\.\/browser-helpers'/d" "$file"
  
  # Add vscode adapter import if not present
  if ! grep -q "vscode-adapter" "$file"; then
    sed -i '' "1i\\
import { vscode } from '../../../vscode-adapter'\\
" "$file"
  fi
done

# Fix System tools  
for file in src/tools/system/*.ts; do
  echo "Processing $file..."
  
  # Remove utils imports
  sed -i '' "/import.*from '\.\.\/\.\.\/utils'/d" "$file"
  sed -i '' "/import.*from '\.\.\/\.\.\/\.\.\/utils'/d" "$file"
  
  # Add vscode adapter import if not present
  if ! grep -q "vscode-adapter" "$file"; then
    sed -i '' "1i\\
import { vscode } from '../../../vscode-adapter'\\
" "$file"
  fi
done

echo "Import fixes complete!"