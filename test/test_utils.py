#!/usr/bin/env python3
"""
Utility functions for MCP test scripts
"""
import os
from pathlib import Path

def get_workspace_root():
    """Get the root directory of the current workspace"""
    # Get the directory where this test file is located
    test_dir = Path(__file__).parent
    # Go up one level to get workspace root
    workspace_root = test_dir.parent
    return workspace_root

def get_test_file_uri(relative_path):
    """
    Convert a relative path to a file:// URI for testing
    
    Args:
        relative_path: Path relative to workspace root (e.g., "src/index.ts")
    
    Returns:
        Full file:// URI for the file
    """
    workspace_root = get_workspace_root()
    full_path = workspace_root / relative_path
    
    # Convert to file:// URI format
    # Handle both Windows and Unix paths
    if os.name == 'nt':  # Windows
        # Windows paths need special handling
        uri = f"file:///{full_path.as_posix()}"
    else:  # Unix-like (Mac, Linux)
        uri = f"file://{full_path.as_posix()}"
    
    return uri

# Common test file paths (relative to workspace root)
TEST_FILES = {
    'package': 'package.json',
    'index': 'src/index.ts',
    'hover': 'src/lsp/hover.ts',
    'errors': 'src/lsp/errors.ts',
    'tools': 'src/mcp/tools.ts',
    'mcp_index': 'src/mcp/index.ts',
    'buffer_manager': 'src/mcp/buffer-manager.ts',
    'definition': 'src/lsp/definition.ts',
    'references': 'src/lsp/references.ts',
}

def get_test_uri(file_key):
    """
    Get a test file URI by key
    
    Args:
        file_key: Key from TEST_FILES dict
    
    Returns:
        Full file:// URI for the test file
    """
    if file_key not in TEST_FILES:
        raise ValueError(f"Unknown test file key: {file_key}")
    
    return get_test_file_uri(TEST_FILES[file_key])