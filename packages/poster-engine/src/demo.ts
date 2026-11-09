import { access, readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareDemoLogos } from './demo-assets.js';
import {
  renderCropDiagnostic,
  renderLayoutDiagnostic,
  renderPosterComparison,
} from './diagnostic.js';
import { loadManifest } from './manifest.js';
import { renderPosterSet } from './render.js';
import type { MatchConfiguration, Player, PosterKind, PosterSetDefinition } from './types.js';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = resolve(packageRoot, '../..');
const templateRoot = resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v5');
const layoutRoot = resolve(packageRoot, 'layouts/barbarians/v5');
const outputRoot = resolve(repositoryRoot, 'tests/output/barbarians/v5');
const fixturePath = resolve(repositoryRoot, 'tests/fixtures/matches/barbarians-demo.json');
const detachedRoot = resolve(repositoryRoot, 'tests/fixtures/players/detoures');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolvePlayer(player: Player, preferDetached: boolean): Promise<Player> {
  if (!player.photoPath) return player;
  const jpegPath = resolve(repositoryRoot, player.photoPath);
  const detachedPath = resolve(
    detachedRoot,
    `${basename(player.photoPath, extname(player.photoPath))}.png`,
  );
  return {
    ...player,
    photoPath: preferDetached && (await fileExists(detachedPath)) ? detachedPath : jpegPath,
  };
}

async function resolveMatch(
  parsed: MatchConfiguration,
  preferDetached: boolean,
): Promise<MatchConfiguration> {
  return {
    ...parsed,
    starters: await Promise.all(
      parsed.starters.map((player) => resolvePlayer(player, preferDetached)),
    ),
    finishers: await Promise.all(
      parsed.finishers.map((player) => resolvePlayer(player, preferDetached)),
    ),
  };
}

const parsedMatch = JSON.parse(await readFile(fixturePath, 'utf8')) as MatchConfiguration;
const [detachedMatch, jpegMatch] = await Promise.all([
  resolveMatch(parsedMatch, true),
  resolveMatch(parsedMatch, false),
]);
const match: MatchConfiguration = {
  ...detachedMatch,
  images: await prepareDemoLogos(
    resolve(repositoryRoot, 'tests/fixtures/templates/barbarians/v2/presentation.png'),
    resolve(outputRoot, 'assets'),
  ),
};

const kinds: PosterKind[] = ['starters', 'finishers', 'presentation'];
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

const jpegDefinitions = definitions
  .filter((definition) => definition.kind !== 'presentation')
  .map((definition) => ({
    ...definition,
    outputPath: resolve(outputRoot, 'comparaison-jpg', basename(definition.outputPath)),
  }));

const outputs = await renderPosterSet(match, definitions);
const jpegOutputs = await renderPosterSet(jpegMatch, jpegDefinitions);
const diagnostics = await Promise.all(
  definitions.map(async (definition) =>
    renderLayoutDiagnostic(
      definition.backgroundPath,
      await loadManifest(definition.manifestPath),
      resolve(outputRoot, `diagnostic-${fileNames[definition.kind]}.png`),
    ),
  ),
);
diagnostics.push(
  await renderCropDiagnostic(
    resolve(detachedRoot, 'joueur_03.png'),
    resolve(outputRoot, 'diagnostic-cadrages.png'),
  ),
);
const comparisons = await Promise.all(
  (['titulaires', 'finisseurs'] as const).map((name) =>
    renderPosterComparison(
      resolve(outputRoot, `${name}.png`),
      resolve(outputRoot, 'comparaison-jpg', `${name}.png`),
      resolve(outputRoot, `comparaison-${name}.png`),
    ),
  ),
);
console.log('Affiches générées :');
for (const output of outputs) {
  console.log(`- ${output}`);
}
console.log('Références JPG générées :');
for (const output of jpegOutputs) {
  console.log(`- ${output}`);
}
console.log('Diagnostics générés :');
for (const diagnostic of diagnostics) {
  console.log(`- ${diagnostic}`);
}
console.log('Comparaisons générées :');
for (const comparison of comparisons) {
  console.log(`- ${comparison}`);
}
