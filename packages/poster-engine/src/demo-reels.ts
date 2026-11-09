import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderLayoutDiagnostic } from './diagnostic.js';
import { loadManifest } from './manifest.js';
import { renderPosterSet } from './render.js';
import type { MatchConfiguration, Player, PosterKind, PosterSetDefinition } from './types.js';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '../..');
const templateRoot = resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v5');
const layoutRoot = resolve(packageRoot, 'layouts/barbarians/v5');
const outputRoot = resolve(repositoryRoot, 'tests/output/barbarians/reels-test');
const fixturePath = resolve(repositoryRoot, 'tests/fixtures/matches/barbarians-reels-demo.json');

function resolvePlayers(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    photoPath: player.photoPath ? resolve(repositoryRoot, player.photoPath) : undefined,
  }));
}

const parsedMatch = JSON.parse(await readFile(fixturePath, 'utf8')) as MatchConfiguration;
const match: MatchConfiguration = {
  ...parsedMatch,
  starters: resolvePlayers(parsedMatch.starters),
  finishers: resolvePlayers(parsedMatch.finishers),
};
const kinds: PosterKind[] = ['starters', 'finishers'];
const fileNames: Record<PosterKind, string> = {
  starters: 'titulaires',
  finishers: 'finisseurs',
  presentation: 'presentation',
};
const definitions: PosterSetDefinition[] = kinds.map((kind) => ({
  kind,
  manifestPath: resolve(layoutRoot, `${fileNames[kind]}.json`),
  backgroundPath: resolve(templateRoot, `${fileNames[kind]}.png`),
  outputPath: resolve(outputRoot, `${fileNames[kind]}.png`),
}));

const outputs = await renderPosterSet(match, definitions);
const diagnostics = await Promise.all(
  definitions.map(async (definition) =>
    renderLayoutDiagnostic(
      definition.backgroundPath,
      await loadManifest(definition.manifestPath),
      resolve(outputRoot, `diagnostic-${fileNames[definition.kind]}.png`),
    ),
  ),
);

console.log('Affiches réelles générées :');
for (const output of outputs) console.log(`- ${output}`);
console.log('Diagnostics générés :');
for (const diagnostic of diagnostics) console.log(`- ${diagnostic}`);
