// main.ts — Dapur Panas: Kitchen Rush
// The entrypoint the grader runs (Node 22). It copies the playable game
// and the screenshots from this repository into the output directory and
// writes dossier.json there with buildDossier from vendor/makefun-game.ts,
// using the same caps as the competition's gate.
//
//   MAKEFUN_OUTPUT_DIR=/output  node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output and
// defaults to ./out when it is not set.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(repoRoot, 'out');

// The dossier caps are the competition's own gate caps: the text is capped
// at 160 KiB, at most 4 screenshots of at most 256 KiB each, and game/ is
// capped at 993 files and 48 MiB with paths of at most 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) {
    throw new Error(`main.ts: missing ${name}/ in the repository`);
  }
  cpSync(src, dst, { recursive: true });
}

function main(): void {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree('game');
  copyTree('screenshots');
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
