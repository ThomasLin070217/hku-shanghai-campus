export interface CompressionPlan {
 source:string;
 role:'music'|'ambience'|'effects';
 sampleRate:number;
 channels:number;
 bitrate:number;
 downmix:string|null;
 ffmpeg:string;
 ffprobe:string;
}
export interface CompressionResult {
 output:string;
 key:string;
 cached:boolean;
}
export function encodingRole(sourcePath:string):'music'|'ambience'|'effects';
export function compressionPlan(sourcePath:string):Promise<CompressionPlan>;
export function compressionCacheKey(sourcePath:string):Promise<string>;
export function compressAudioFile(sourcePath:string,outputPath?:string):Promise<CompressionResult>;
