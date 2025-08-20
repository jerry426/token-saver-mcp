import { defineConfig } from 'tsup'
import pkg from './package.json'

// Define packages to exclude (these are provided at runtime)
const externalPackages = ['vscode']

// Automatically get all dependencies to bundle (excluding those specified in external)
const dependencies = Object.keys(pkg.dependencies || {})
const noExternalPackages = dependencies.filter(dep => !externalPackages.includes(dep))

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  format: ['cjs'],
  clean: true,
  minify: false,
  bundle: true,
  /**
   * Polyfill Node-specific features (like __dirname, require)
   * For ESM format, these Node built-ins don't exist, setting shims: true will simulate them
   */
  shims: true,
  target: 'node16',
  platform: 'node',
  external: externalPackages,
  // Automatically bundle all dependencies (except those specified in external)
  noExternal: noExternalPackages,

  plugins: [
    {
      name: 'build-notify',
      buildEnd() {
        console.log('Build completed')
      },
    },
  ],
})
