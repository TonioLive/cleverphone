#!/usr/bin/env python3
"""Crop neutral margins from cached original-resolution Apple photos before resizing."""
import hashlib, io, json, os, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[2]
CACHE=Path('/tmp/clever-media-cache')
MANIFEST=ROOT/'data/media-apple-samsung.json'
MODELS=['Apple|iPhone 17','Apple|iPhone 17 Pro Max','Apple|iPhone 18 Pro','Apple|iPhone 18 Pro Max']
def original(url):
 cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
 if cache.exists():return cache.read_bytes()
 data=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read();cache.write_bytes(data);return data

def improve(job):
 model,color,photo=job;dest=ROOT/'public'/photo['src'].lstrip('/')
 im=Image.open(io.BytesIO(original(photo['sourceUrl']))).convert('RGBA');before=Image.open(dest).size
 # Already adequate assets remain unchanged. Small original box photos are kept at native resolution.
 if max(before)>=1000 or max(im.size)<1500:return model,color,dest.name,before,before,'native/adequate'
 if im.getchannel('A').getextrema()[0]<250:
  bbox=im.getchannel('A').getbbox()
 else:
  rgb=im.convert('RGB');bg=Image.new('RGB',rgb.size,rgb.getpixel((0,0)))
  diff=ImageChops.difference(rgb,bg).convert('L').point(lambda x:255 if x>25 else 0);bbox=diff.getbbox()
 if not bbox:return model,color,dest.name,before,before,'empty'
 pad=int(max(bbox[2]-bbox[0],bbox[3]-bbox[1])*.06)
 box=(max(0,bbox[0]-pad),max(0,bbox[1]-pad),min(im.width,bbox[2]+pad),min(im.height,bbox[3]+pad))
 im=im.crop(box);im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
 temp=dest.with_name(dest.stem+'-highres-next.webp');im.save(temp,'WEBP',quality=90,method=6);os.replace(temp,dest)
 return model,color,dest.name,before,im.size,'improved'

def main():
 d=json.loads(MANIFEST.read_text());jobs=[(k,c['key'],im) for k in MODELS for c in d[k]['colors'] for im in c['images']]
 results=list(ThreadPoolExecutor(4).map(improve,jobs))
 for result in results:
  if result[-1]=='improved':print(*result,flush=True)
 print(json.dumps({'improved':sum(x[-1]=='improved' for x in results),'nativeOrAdequate':sum(x[-1]!='improved' for x in results),'manifestChanged':False}))
if __name__=='__main__':main()
