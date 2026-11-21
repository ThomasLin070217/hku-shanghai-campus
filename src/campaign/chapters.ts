import {createB4Chapter} from './b4Chapter';
import {createLawnChapter} from './lawnChapter';
import {createSportsChapter} from './sportsChapter';
import {createEndingChapter} from './endingChapter';
import type {Chapter,ChapterId} from './types';

/** Chapter factories in story order. Creating one is cheap; scenery is built in `attach`. */
export const CAMPAIGN_CHAPTERS:Record<ChapterId,()=>Chapter>={b4:createB4Chapter,lawn:createLawnChapter,sports:createSportsChapter,ending:createEndingChapter};
