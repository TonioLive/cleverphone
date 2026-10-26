#!/usr/bin/env python3
import urllib.request,urllib.parse,json,re,html,io,hashlib,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/media-apple-samsung.json'
CACHE=Path('/tmp/clever-media-cache');CACHE.mkdir(exist_ok=True)
UA={'User-Agent':'Mozilla/5.0'}
def fetch(url):
 key=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.bin')
 if key.exists(): return key.read_bytes()
 for attempt in range(3):
  try:
   b=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=25).read();key.write_bytes(b);return b
  except Exception:
   if attempt==2:raise
   time.sleep(.3)
def page(url):return fetch(url).decode()
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
def save_image(url,path):
 dest=ROOT/'public'/path.lstrip('/');dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.exists(): return
 b=fetch(url);im=Image.open(io.BytesIO(b)).convert('RGBA');im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
 # Preserve the actual manufacturer's framing and the white/transparent background.
 im.save(dest,'WEBP',quality=86,method=6)
def sam_gallery(model,url,label,key,color):
 s=page(url); items=[]
 for li in re.findall(r'<li[^>]+class="[^"]*(?:hdd02|pd-g-product)-gallery[^>]*>.*?</li>',s,re.S):
  if 'thumb' in li[:150]: continue
  urls=re.findall(r'(?:src|data-desktop-src)="((?:https:)?//images.samsung.com/[^\"]+/gallery/[^\"]+)"',li)
  urls=[html.unescape(x) for x in urls if '-thumb-' not in x and 'LazyLoad' not in x]
  if not urls:continue
  alt=re.search(r'alt="([^"]+)"',li);alt=html.unescape(alt.group(1)) if alt else 'Samsung Galaxy '+model
  u=urls[0];u='https:'+u if u.startswith('//') else u
  if u.split('?')[0] not in [x[0].split('?')[0] for x in items]:items.append((u,alt))
 if len(items)<4:
  # Older product headers use the same official gallery assets in data-src attributes.
  for tag in re.findall(r'<img\b[^>]*>',s):
   urls=re.findall(r'(?:src|data-desktop-src|data-src)="((?:https:)?//images.samsung.com/[^\"]+/gallery/[^\"]+)"',tag)
   if not urls:continue
   u=html.unescape(urls[0]);u='https:'+u if u.startswith('//') else u
   if '-thumb-' in u or 'LazyLoad' in u:continue
   a=re.search(r'alt="([^"]*)"',tag);alt=html.unescape(a.group(1)) if a else 'Samsung Galaxy '+model
   if u.split('?')[0] not in [x[0].split('?')[0] for x in items]:items.append((u,alt))
 # Selected manufacturer views: front, rear, angle, side.
 if len(items)>4:
  chosen=[]
  for pattern in [r'\bfront\s',r'\bback\s',r'\bback[- ]?[rl]',r'side']:
   match=next((x for x in items if re.search(pattern,x[1],re.I) and x not in chosen),None)
   if match:chosen.append(match)
  for x in items:
   if len(chosen)>=4:break
   if x not in chosen:chosen.append(x)
  items=chosen
 imgs=[]
 for i,(u,a) in enumerate(items):
  p='/images/products/'+slug('samsung-'+model)+'/'+key+'-'+str(i+1)+'.webp'
  try:save_image(u,p);imgs.append({'src':p,'alt':a,'view':('Vista trasera' if re.search(r'\bback\s',a,re.I) else 'Vista lateral' if 'side' in a.lower() else 'Vista en perspectiva' if re.search(r'(?:back|front)[- ]?[rl]',a,re.I) else 'Vista frontal y trasera' if i==0 else 'Vista frontal'),'sourceUrl':u})
  except Exception as e:print('IMAGE ERROR',model,e,flush=True)
 return {'sourceUrl':url,'sourceName':'Samsung','retrievedAt':'2026-10-25','status':'complete' if len(imgs)>=4 else 'partial','colors':[{'key':key,'label':label,'hex':color,'images':imgs}]}
SOURCES={
'A18':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a18-black-256gb-sm-a185fzkheub/buy/','Negro','black','#222426'),
'A17':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a17-black-128gb-sm-a175fzkbeub/buy/','Negro','black','#202529'),
'A17 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a17-5g-black-256gb-sm-a176bzkdeub/buy/','Negro','black','#202529'),
'A27 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a27-5g-black-128gb-sm-a276bzkbeub/buy/','Negro','black','#252626'),
'A37 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a37-5g-awesome-lavender-256gb-sm-a376blvgeub/buy/','Lavanda','lavender','#c8b7dd'),
'A57 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a57-5g-awesome-navy-512gb-sm-a576bdbheub/buy/','Azul oscuro','navy','#3d4059'),
'A35 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a35-5g-awesome-navy-128gb-sm-a356bzkbeub/buy/','Azul oscuro','navy','#3e3e51'),
'A54 5G':('https://www.samsung.com/es/smartphones/galaxy-a/galaxy-a54-5g-awesome-white-256gb-sm-a546bzwdeub/buy/','Blanco','white','#eceee9'),
'A25 5G':('https://www.samsung.com/ph/smartphones/galaxy-a/galaxy-a25-5g-blue-256gb-sm-a256ezkhphl/','Negro azulado','blue-black','#2d3a4b'),
'A07':('https://www.samsung.com/ph/smartphones/galaxy-a/galaxy-a07-black-256gb-sm-a075fzkiphl/buy/','Negro','black','#222d31'),
'A06':('https://www.samsung.com/levant/smartphones/galaxy-a/galaxy-a06-black-128gb-sm-a065fzkgmea/','Negro','black','#303532'),
'A16':('https://www.samsung.com/nl/smartphones/galaxy-a/galaxy-a16-black-128gb-sm-a165fzkbeub/','Negro','black','#242f33'),
}
def run_samsung():
 d=json.loads(OUT.read_text()) if OUT.exists() else {}
 def f(pair):
  m,args=pair
  try:
   result=sam_gallery(m,*args);print(m,result['status'],[len(c['images']) for c in result['colors']],flush=True);return 'Samsung|'+m,result
  except Exception as e:print('PAGE ERROR',m,e,flush=True);return 'Samsung|'+m,{'sourceUrl':args[0],'sourceName':'Samsung','status':'unverified','note':'No se pudo recuperar la galería del modelo exacto.','colors':[]}
 for k,v in ThreadPoolExecutor(6).map(f,SOURCES.items()):d[k]=v;OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
# Importable research helpers. Final curated manifests also include manual QA fixes.

def apple_gallery(model,family,colors,size=None):
 url='https://www.apple.com/shop/buy-iphone/'+family
 s=page(url)
 result={'sourceUrl':url,'sourceName':'Apple','retrievedAt':'2026-10-25','status':'partial','colors':[]}
 for key,label,hx in colors:
  api='https://www.apple.com/shop/api/product-gallery?fae=true&node=home/shop_iphone/family/'+family.replace('-','_')+'/select&dm.dimensionColor='+key
  if size:api+='&dm.dimensionScreensize='+size
  d=json.loads(fetch(api));items=d.get('body',{}).get('dimensionColor',[])
  urls=[]
  for item in items:
   im=item.get('asset',{}).get('image',{})
   if im.get('sources'):urls.append((im['sources'][0]['srcSet'],im.get('alt','')))
  # The product's rear view shown in the official "What's in the box" section is a fourth distinct view.
  for mat in re.finditer(r'<img\b[^>]*>',s):
   tag=mat.group();srcs=re.findall(r'(?:src|data-src)="([^\"]+)"',tag)
   if not srcs:continue
   u=html.unescape(srcs[0])
   if family+'-witb-'+key in u or (family+'-max-witb-'+key in u):
    a=re.search(r'alt="([^"]*)"',tag);urls.append((u,html.unescape(a.group(1)) if a else model+' · vista trasera'));break
  if len(urls)<4:
   for u in re.findall(r'https://store\.storeimages\.cdn-apple\.com/[^\s<>\"\\]+',s):
    u=html.unescape(u)
    if ('witb-'+key) in u and ('cable' not in u) and ('iphone' in u) and 'wid=' in u:
     urls.append((u,model+' · vista trasera'));break
  imgs=[]
  for i,(u,alt) in enumerate(urls[:4]):
   p='/images/products/'+slug('apple-'+model)+'/'+key+'-'+str(i+1)+'.webp'
   try:save_image(u,p);imgs.append({'src':p,'alt':alt or model+' '+label,'view':['Vista frontal y trasera','Vista en perspectiva','Detalle de cámara','Vista trasera'][i],'sourceUrl':u})
   except Exception as e:print('APPLE IMAGE ERROR',model,key,e,flush=True)
  result['colors'].append({'key':key,'label':label,'hex':hx,'images':imgs})
 result['status']='complete' if result['colors'] and all(len(c['images'])>=4 for c in result['colors']) else 'partial'
 return result

def run_apple_current():
 jobs=[('iPhone 17','iphone-17',[('black','Negro','#292a2c'),('white','Blanco','#f4f3ec'),('sage','Verde salvia','#aeb8ab'),('mistblue','Azul neblina','#b1c3d3'),('lavender','Lavanda','#c4bbda')],None),('iPhone 16','iphone-16',[('black','Negro','#293133'),('white','Blanco','#f6f5f0'),('ultramarine','Azul ultramar','#9c9ee7'),('teal','Verde azulado','#86a6a6'),('pink','Rosa','#e4a4c7')],None),('iPhone 18 Pro','iphone-18-pro',[('black','Negro','#33353a'),('silver','Plata','#e4e4e2'),('burgundy','Burdeos','#6d273c'),('glacier','Glaciar','#a7c9df')],'6_3inch'),('iPhone 18 Pro Max','iphone-18-pro',[('black','Negro','#33353a'),('silver','Plata','#e4e4e2'),('burgundy','Burdeos','#6d273c'),('glacier','Glaciar','#a7c9df')],'6_9inch')]
 def f(args):
  try:
   r=apple_gallery(*args);print(args[0],r['status'],[len(x['images']) for x in r['colors']],flush=True);return 'Apple|'+args[0],r
  except Exception as e:print('APPLE ERROR',args[0],e,flush=True);return None
 d=json.loads(OUT.read_text())
 for r in ThreadPoolExecutor(4).map(f,jobs):
  if r:d[r[0]]=r[1];OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')

COLOR_MAP={
'BLA':('black','Negro','#292a2c'),'WHI':('white','Blanco','#f1f0ec'),'BLU':('blue','Azul','#7f9ab9'),'GRE':('green','Verde','#a8bdad'),'RED':('red','Rojo','#c83543'),'PUR':('purple','Púrpura','#c3b7cf'),'PIN':('pink','Rosa','#e7cbd1'),'MID':('midnight','Medianoche','#252a33'),'STA':('starlight','Blanco estrella','#eee9df'),'SIL':('silver','Plata','#e0e1df'),'GOL':('gold','Oro','#dfcfb5'),'SPA':('space-black','Negro espacial','#383838'),'DEE':('deep-purple','Morado oscuro','#635a6e'),'NAT':('natural-titanium','Titanio natural','#b2ada2'),'BLA-TIT':('black-titanium','Titanio negro','#414447'),'WHI-TIT':('white-titanium','Titanio blanco','#dddcd4'),'BLU-TIT':('blue-titanium','Titanio azul','#485966'),
}
def reebelo_gallery(model,url,brand='Apple'):
 s=page(url);rawurls=list(dict.fromkeys(re.findall(r'https://cdn\.reebelo\.com/pim/products/[^\s<>\"\\]+\.(?:jpg|png|webp)',s)))
 groups={}
 for u in rawurls:
  name=u.rsplit('/',1)[1];code=re.sub(r'-image-\d+\.[a-z]+$','',name)
  if code in ['Collection','Main']:continue
  groups.setdefault(code,[]).append(u)
 result={'sourceUrl':url,'sourceName':'Reebelo','retrievedAt':'2026-10-25','status':'partial','colors':[]}
 for code,urls in groups.items():
  # Main PIM gallery keyed by the actual published color code.
  if len(urls)<4:continue
  key,label,hx=COLOR_MAP.get(code,(slug(code),code,'#70757b'))
  imgs=[]
  for i,u in enumerate(urls[:4]):
   p='/images/products/'+slug(brand+'-'+model)+'/'+key+'-'+str(i+1)+'.webp'
   try:save_image(u,p);imgs.append({'src':p,'alt':model+' '+label+' · vista '+str(i+1),'view':['Vista frontal y trasera','Vista frontal','Vista trasera','Vista en perspectiva'][i],'sourceUrl':u})
   except Exception as e:print('REEBELO IMAGE ERROR',model,code,e,flush=True)
  result['colors'].append({'key':key,'label':label,'hex':hx,'images':imgs})
 result['status']='complete' if result['colors'] and all(len(c['images'])>=4 for c in result['colors']) else 'partial'
 return result

def run_reebelo():
 jobs=[('iPhone 12','https://reebelo.com/collections/apple-iphone-12'),('iPhone 13','https://reebelo.com/collections/apple-iphone-13'),('iPhone 14 Plus','https://reebelo.com/collections/apple-iphone-14-plus'),('iPhone 14 Pro','https://reebelo.es/collections/apple-iphone-14-pro'),('iPhone 14 Pro Max','https://reebelo.es/collections/apple-iphone-14-pro-max'),('iPhone 17 Pro Max','https://reebelo.es/collections/apple-iphone-17-pro-max')]
 def f(args):
  try:
   r=reebelo_gallery(*args);print(args[0],r['status'],[(x['key'],len(x['images'])) for x in r['colors']],flush=True);return 'Apple|'+args[0],r
  except Exception as e:print('REEBELO PAGE ERROR',args[0],e,flush=True);return None
 d=json.loads(OUT.read_text())
 for r in ThreadPoolExecutor(6).map(f,jobs):
  if r:d[r[0]]=r[1];OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')

def crop_neutral_margin(src):
 dest=ROOT/'public'/src.lstrip('/')
 im=Image.open(dest).convert('RGBA')
 if im.getchannel('A').getextrema()[0]<250:
  bbox=im.getchannel('A').getbbox()
 else:
  rgb=im.convert('RGB');bg=Image.new('RGB',rgb.size,rgb.getpixel((0,0)))
  diff=ImageChops.difference(rgb,bg).convert('L').point(lambda x:255 if x>25 else 0);bbox=diff.getbbox()
 if not bbox:return
 pad=int(max(bbox[2]-bbox[0],bbox[3]-bbox[1])*.06)
 bbox=(max(0,bbox[0]-pad),max(0,bbox[1]-pad),min(im.width,bbox[2]+pad),min(im.height,bbox[3]+pad))
 if bbox[2]-bbox[0]>.9*im.width and bbox[3]-bbox[1]>.9*im.height:return
 im=im.crop(bbox);im.thumbnail((1200,1200),Image.Resampling.LANCZOS);im.save(dest,'WEBP',quality=88,method=6)
