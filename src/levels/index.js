// The five levels, in play order. Each is a Tiled map (open the .json files in Tiled to edit them).
import { parseLevel } from './parse.js';
import level1 from './level1.json';
import level2 from './level2.json';
import level3 from './level3.json';
import level4 from './level4.json';
import level5 from './level5.json';

export const LEVELS = [level1, level2, level3, level4, level5].map(parseLevel);
