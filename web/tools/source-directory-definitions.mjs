import { VERIFIED_PLACE_SUPPLEMENT } from './verified-place-supplement.mjs';
import { SOURCE_DIRECTORY_CHAINS } from './source-directory-chains.mjs';
import { SOURCE_DIRECTORY_BANKS } from './source-directory-banks.mjs';
import { SOURCE_DIRECTORY_INSTITUTIONS } from './source-directory-institutions.mjs';
import { SOURCE_DIRECTORY_POST } from './source-directory-post.mjs';
import { SOURCE_DIRECTORY_MALLS_HEALTH } from './source-directory-malls-health.mjs';
import { SOURCE_DIRECTORY_FOOD } from './source-directory-food.mjs';
import { SOURCE_DIRECTORY_PHARMACIES } from './source-directory-pharmacies.mjs';

// Previously published directory IDs are resolved before subsequent sources.
export const SOURCE_DIRECTORY_DEFINITIONS = [
  ...VERIFIED_PLACE_SUPPLEMENT, ...SOURCE_DIRECTORY_CHAINS, ...SOURCE_DIRECTORY_BANKS,
  ...SOURCE_DIRECTORY_INSTITUTIONS, ...SOURCE_DIRECTORY_POST, ...SOURCE_DIRECTORY_MALLS_HEALTH,
  ...SOURCE_DIRECTORY_FOOD,
  ...SOURCE_DIRECTORY_PHARMACIES,
];
