import {OPENING_MAX_HEARTS,damageOpeningHearts,healOpeningHearts,type OpeningRuntime} from './runtime';
import type {ChapterContext} from '../campaign/types';

export type HeartsChannel=NonNullable<ChapterContext['hearts']>;

/**
 * The opening runtime's hearts as one store for every chapter. `write` is the
 * experience's own runtime setter, so the vitals HUD and the opening save see
 * the change; damage goes through the same reducer as a robot catch.
 */
export function createHeartsChannel(read:()=>OpeningRuntime,write:(next:OpeningRuntime)=>void):HeartsChannel{
 return{
  get:()=>read().hearts,
  max:OPENING_MAX_HEARTS,
  damage(n){const next=damageOpeningHearts(read(),n).runtime;write(next);return next.hearts;},
  heal(){const next=healOpeningHearts(read());write(next);return next.hearts;},
 };
}
