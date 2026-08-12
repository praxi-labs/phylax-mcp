import { chmod } from 'node:fs/promises'

try {
  await chmod('dist/index.js', 0o755)
} catch {
  process.exit(0)
}
