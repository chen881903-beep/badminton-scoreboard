const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = __dirname;
const scope = 'https://example.github.io/badminton-scoreboard/';
const source = fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));

function worker({version='2.2.0', stores=new Map(), offline=false, broken=null}={}) {
  const events = {}, requests = [];
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name,new Map());
      const entries=stores.get(name);
      return {
        async addAll(requests) {
          const responses=await Promise.all(requests.map(request=>fetchResource(request)));
          if(responses.some(response=>!response.ok)) throw Error('precache failed');
          requests.forEach((request,i)=>entries.set(key(request),responses[i]));
        },
        async match(request){return entries.get(key(request));}
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  async function fetchResource(request){
    requests.push(request);
    if(offline)throw Error('offline');
    const url=new URL(key(request));
    const file=decodeURIComponent(url.pathname.replace('/badminton-scoreboard/',''));
    if(file===broken || !fs.existsSync(path.join(ROOT,file)))return new Response('missing',{status:404});
    return new Response(fs.readFileSync(path.join(ROOT,file)));
  }
  vm.runInNewContext(source.replace('const VERSION = "2.2.0"',`const VERSION = "${version}"`),{
    self:{registration:{scope},addEventListener(type,callback){events[type]=callback;}},
    caches,Request,URL,fetch:fetchResource
  });
  return {stores,requests,
    async lifecycle(type){let promise;events[type]({waitUntil(p){promise=p;}});await promise;},
    async get(url,{mode='cors',method='GET'}={}){
      let response;events.fetch({request:{url,mode,method},respondWith(p){response=p;}});
      return response===undefined?undefined:await response;
    }
  };
}
test('PWA manifest: names, standalone, scope and start URL stay under GitHub Pages project',()=>{
  assert.equal(manifest.name,'祥云球场记分板');assert.equal(manifest.display,'standalone');
  for(const key of ['id','start_url','scope'])assert.equal(new URL(manifest[key],scope).href,scope);
  for(const icon of manifest.icons){
    assert.ok(new URL(icon.src,scope).href.startsWith(scope));
    const png=fs.readFileSync(path.join(ROOT,icon.src));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const size=Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
});
test('PWA install caches every actual HTML resource including versioned scripts and icons',async()=>{
  const sw=worker();await sw.lifecycle('install');
  assert.equal(sw.requests.length,8);
  for(const request of sw.requests){assert.equal(request.cache,'reload');assert.ok(request.url.startsWith(scope));}
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const resources=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>new URL(match[1],scope).href);
  const cached=[...sw.stores.values()][0];
  for(const url of resources)assert.ok(cached.has(url),'cached HTML asset: '+url);
});
test('PWA offline: root, index and navigation query variants load full app bundle',async()=>{
  const online=worker();await online.lifecycle('install');
  const offline=worker({stores:online.stores,offline:true});
  for(const url of [scope,scope+'index.html',scope+'?v=mobile',scope+'index.html?v=2.2']){
    const response=await offline.get(url,{mode:'navigate'});
    assert.match(await response.clone().text(),/祥云球场记分板/);
  }
  for(const resource of ['style.css?v=2.1-court-first','app.js?v=2.1','scoring.js','pwa.js?v=2.2.0','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png']){
    assert.equal((await offline.get(scope+resource)).status,200);
  }
  assert.equal(offline.requests.length,0,'offline startup uses no network requests');
});
test('PWA update: new version fully cached, only same-scope old cache removed, no forced takeover',async()=>{
  const old=worker();await old.lifecycle('install');
  const unrelated='another-app-cache', otherScope='xiangyun-scoreboard:https://example.github.io/other/:2.1';
  old.stores.set(unrelated,new Map());old.stores.set(otherScope,new Map());
  const next=worker({version:'2.2.1',stores:old.stores});await next.lifecycle('install');
  assert.ok([...next.stores.keys()].some(key=>key.endsWith(':2.2.0')),'install leaves active cache intact');
  await next.lifecycle('activate');
  assert.ok(![...next.stores.keys()].some(key=>key.endsWith(':2.2.0')));
  assert.ok(next.stores.has(unrelated));assert.ok(next.stores.has(otherScope));
  assert.doesNotMatch(source,/self\.skipWaiting\s*\(|clients\.claim\s*\(/);
  assert.doesNotMatch(source,/localStorage\s*\.|indexedDB\.deleteDatabase/);
});
test('PWA failed install: missing file rejects install; previous offline bundle remains usable',async()=>{
  const old=worker();await old.lifecycle('install');
  const next=worker({version:'2.2.1',stores:old.stores,broken:'scoring.js'});
  await assert.rejects(()=>next.lifecycle('install'),/precache failed/);
  const offline=worker({stores:old.stores,offline:true});
  assert.equal((await offline.get(scope,{mode:'navigate'})).status,200);
  assert.equal((await offline.get(scope+'scoring.js')).status,200);
});
test('PWA only intercepts explicit app resources, not other projects, origins or POST requests',async()=>{
  const sw=worker();await sw.lifecycle('install');
  assert.equal(await sw.get('https://other.example/index.html',{mode:'navigate'}),undefined);
  assert.equal(await sw.get('https://example.github.io/other/',{mode:'navigate'}),undefined);
  assert.equal(await sw.get(scope+'not-found',{mode:'navigate'}),undefined);
  assert.equal(await sw.get(scope+'scoring.js',{method:'POST'}),undefined);
});
test('PWA leaves app.js, scoring.js, CSS and localStorage key unchanged from V2.1',()=>{
  for(const file of ['app.js','scoring.js','style.css'])assert.deepEqual(
    fs.readFileSync(path.join(ROOT,file)),fs.readFileSync(path.join(ROOT,'../badminton_web',file)));
  assert.match(fs.readFileSync(path.join(ROOT,'app.js'),'utf8'),/const KEY = "badminton_web.match.v2"/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT,'pwa.js'),'utf8'),/localStorage\.(clear|removeItem)/);
});

async function registrationPage({secure=true,waiting=false,fail=false}={}){
  const element={textContent:''}, hooks={}, options={};
  const registration={waiting:waiting?{}:null,update:async()=>{},addEventListener(type,callback){hooks[type]=callback;}};
  const navigator={serviceWorker:{ready:Promise.resolve(registration),async register(url,settings){
    options.url=url;options.settings=settings;if(fail)throw Error('registration failed');return registration;
  }}};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pwa.js'),'utf8'),{
    document:{baseURI:scope+'index.html?v=2.2',getElementById:()=>element},
    window:{isSecureContext:secure},navigator,URL
  });
  await new Promise(resolve=>setImmediate(resolve));
  return {element,options};
}
test('PWA registration uses relative project scope, bypasses HTTP cache, reports offline readiness',async()=>{
  const page=await registrationPage();
  assert.equal(page.options.url,scope+'sw.js');assert.equal(page.options.settings.scope,scope);
  assert.equal(page.options.settings.updateViaCache,'none');assert.match(page.element.textContent,/離線資源已準備/);
});
test('PWA registration reports pending update, unsupported HTTP and registration errors safely',async()=>{
  assert.match((await registrationPage({waiting:true})).element.textContent,/關閉所有/);
  const insecure=await registrationPage({secure:false});assert.equal(insecure.options.url,undefined);
  assert.match(insecure.element.textContent,/HTTPS/);
  assert.match((await registrationPage({fail:true})).element.textContent,/尚未準備好/);
});
