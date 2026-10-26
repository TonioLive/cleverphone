import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
await mkdir('.sites-runtime',{recursive:true});
const output=path.resolve('.sites-runtime/catalog-media-qa.mjs');
await build({entryPoints:['lib/catalog.ts'],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {getPublicCatalog}=await import(pathToFileURL(output).href+'?v='+Date.now());
const all=getPublicCatalog(),models=new Set(all.map(p=>p.slug));let galleries=0;
for(const model of models){
 const p=getPublicCatalog(model).find(p=>p.slug===model);
 if(!p.colors.length)throw Error(`No gallery: ${model}`);
 for(const color of p.colors){
  const hashes=new Set();
  for(const photo of color.images){
   if(!photo.src.startsWith('/images/products/')||photo.src.includes('..'))throw Error(`Unsafe media path: ${photo.src}`);
   const bytes=await readFile(path.join('public',photo.src));
   if(bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error(`Invalid WebP: ${photo.src}`);
   hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  if(hashes.size!==4)throw Error(`${model} ${color.key}: expected 4 distinct images, found ${hashes.size}`);
  galleries++;
 }
}
for(const p of all)if(['cost','sourceLine','contributionTarget','estimatedContribution'].some(key=>Object.hasOwn(p,key)))throw Error('Private commercial fields in public catalogue');
console.log(JSON.stringify({variants:all.length,models:models.size,colourGalleries:galleries,distinctImagesPerGallery:4,privateCostFields:'absent'}));
