// Run: node --test test.cjs  (or node test.cjs). No installation needed.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const R = require('./scoring.js');
const KEY = 'badminton_web.match.v2';
const copy = x => JSON.parse(JSON.stringify(x));

// A fresh VM executes the real app.js on each "reload".
// Storage belongs to this fixture only; it never touches real browser records.
function browser({saved=new Map(), confirm=true, failRead=false, failWrite=false}={}) {
  const html = fs.readFileSync(__dirname+'/index.html','utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {value:'',disabled:false,textContent:'',children:[],attributes:{},
      classList:{toggle(name,on){on?classes.add(name):classes.delete(name);},contains:name=>classes.has(name)},
      replaceChildren(){this.children=[];},append(child){this.children.push(child);},
      setAttribute(k,v){this.attributes[k]=v;},
      addEventListener(type,handler){this[type]=handler;}
    };
  }
  const document = {createElement:element,getElementById(id){
    assert.ok(ids.has(id),'app uses a real HTML element: '+id);
    if(!elements.has(id)) elements.set(id,element());
    return elements.get(id);
  }};
  const context = vm.createContext({Scoring:R,document,confirm:()=>confirm,
    localStorage:{getItem(k){if(failRead) throw Error('read denied');return saved.get(k)??null;},
      setItem(k,v){if(failWrite) throw Error('write denied');saved.set(k,v);}}});
  vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
  return {$:document.getElementById,saved,
    snapshot:()=>copy(vm.runInContext('({state,history,first,firstServer,firstReceiver,names,notice})',context)),
    click(id){const el=document.getElementById(id); if(!el.disabled) el.click();},
    change(id,value){const el=document.getElementById(id);assert.equal(el.disabled,false);el.value=value;el.change();}
  };
}
const tie = n => R.replay('A','A1','B1',Array.from({length:n},()=>['A','B']).flat()).state;

test('發球方連得分：同一人繼續發球，僅該隊交換站位，舊快照不變',()=>{
  const start=R.initial(), before=copy(start);
  const one=R.point(start,'A'), two=R.point(one,'A');
  assert.deepEqual(start,before);
  assert.deepEqual(one.positions,{A:{right:'A2',left:'A1'},B:{right:'B1',left:'B2'}});
  assert.deepEqual(R.service(one),{side:'left',server:'A1',receiver:'B2'});
  assert.deepEqual(two.positions,start.positions);
  assert.deepEqual(R.service(two),{side:'right',server:'A1',receiver:'B1'});
});
test('接發球方得分：轉換發球權，四位球員均不換位',()=>{
  const start=R.initial(), next=R.point(start,'B');
  assert.equal(next.server,'B'); assert.deepEqual(next.positions,start.positions);
  assert.deepEqual(R.service(next),{side:'left',server:'B2',receiver:'A2'});
});
test('四名球員均可正確成為發球／接發球員，八種開局組合',()=>{
  for(const team of ['A','B']) for(const n of ['1','2']) for(const m of ['1','2']){
    const other=team==='A'?'B':'A', start=R.initial(team,team+n,other+m);
    assert.deepEqual(R.service(start),{side:'right',server:team+n,receiver:other+m});
  }
  let s=R.initial(); const servers=new Set(), receivers=new Set();
  for(const team of ['A','A','B','B','A','B','A']){
    s=R.point(s,team); const pair=R.service(s);servers.add(pair.server);receivers.add(pair.receiver);
  }
  assert.deepEqual([...servers].sort(),['A1','A2','B1','B2']);
  assert.deepEqual([...receivers].sort(),['A1','A2','B1','B2']);
});
test('撤銷：逐球恢復完整狀態、發球接發球身份及歷史，空歷史安全',()=>{
  const rallies=['A','A','B','B','A','B'];
  let match=R.replay('A','A2','B2',rallies), oldHistory=copy(match.history);
  for(let length=rallies.length-1;length>=0;length--){
    match=R.undo(match.state,match.history);
    assert.deepEqual(match,R.replay('A','A2','B2',rallies.slice(0,length)));
  }
  assert.deepEqual(oldHistory,R.replay('A','A2','B2',rallies).history);
  assert.deepEqual(R.undo(match.state,[]),match);
});
test('20:20 後：21:20 未勝，22:20 勝；雙方均適用',()=>{
  for(const team of ['A','B']){
    let s=tie(20);assert.equal(R.winner(s),null);
    s=R.point(s,team);assert.equal(R.winner(s),null);
    const extended=R.point(s,team==='A'?'B':'A');assert.equal(R.winner(extended),null);
    s=R.point(s,team);assert.equal(R.winner(s),team);
    assert.equal(R.point(s,team),s);
  }
});
test('29:29：任何一方取得 30 分即勝，完局後不再加分',()=>{
  for(const team of ['A','B']){
    const s=R.point(tie(29),team);
    assert.equal(R.winner(s),team);
    assert.equal(team==='A'?s.a:s.b,30);
    assert.equal(R.point(s,'A'),s);assert.equal(R.point(s,'B'),s);
  }
});
test('真實頁面處理函數：重新整理完整恢復比分、站位、名字與撤銷歷史',()=>{
  let page=browser();const saved=page.saved;
  assert.equal(page.$('prematch-settings').open,true);
  page.change('opening-server','A2');page.change('opening-receiver','B2');
  page.change('name-A2','小明');
  for(const team of ['a','a','b','b','a'])page.click('point-'+team);
  const before=page.snapshot();page=browser({saved});
  assert.equal(page.$('prematch-settings').open,false);
  // Even if someone opens the panel and dispatches events directly, order is locked.
  page.$('prematch-settings').open=true;
  page.$('first-b').click();
  page.$('opening-server').value='A1';page.$('opening-server').change();
  assert.deepEqual(page.snapshot(),before);
  assert.deepEqual(page.snapshot(),before);
  page.click('undo');
  assert.deepEqual(page.snapshot().state,before.history.at(-1));
  assert.deepEqual(page.snapshot().history,before.history.slice(0,-1));
});
test('重設並重新整理：比分及歷史清空，站位回開局，保留名稱和開局設定',()=>{
  let page=browser();const saved=page.saved;
  page.click('confirm-setup');assert.equal(page.$('prematch-settings').open,false);
  page.change('opening-server','A2');page.change('opening-receiver','B2');
  page.change('name-A2','小明');
  for(const team of ['a','b','b','a'])page.click('point-'+team);
  assert.equal(page.$('prematch-settings').open,false);
  page.click('restart');
  assert.equal(page.$('prematch-settings').open,true);
  const reset=page.snapshot();
  assert.deepEqual(reset.state,R.initial('A','A2','B2'));assert.deepEqual(reset.history,[]);
  assert.equal(reset.names.A2,'小明');
  assert.deepEqual(JSON.parse(saved.get(KEY)).rallies,[]);
  page=browser({saved});assert.deepEqual(page.snapshot(),reset);
  assert.equal(page.$('prematch-settings').open,true);
  assert.equal(page.$('undo').disabled,true);
  assert.equal(page.$('opening-server').disabled,false);
  page.click('undo');assert.deepEqual(page.snapshot(),reset);
  page.click('point-b');assert.deepEqual(page.snapshot().state,R.point(reset.state,'B'));
});
test('取消重設：記憶體及保存資料完全不變',()=>{
  const page=browser({confirm:false});page.click('point-a');
  const before=page.snapshot(), raw=page.saved.get(KEY);
  page.click('restart');assert.deepEqual(page.snapshot(),before);assert.equal(page.saved.get(KEY),raw);
});
test('完局後撤銷：恢復完整狀態及得分按鈕',()=>{
  const page=browser();
  for(let i=0;i<20;i++)page.click('point-a');
  const before=page.snapshot();page.click('point-a');
  assert.equal(page.$('point-b').disabled,true);
  page.click('undo');assert.deepEqual(page.snapshot(),before);
  assert.equal(page.$('point-b').disabled,false);
});
test('損壞紀錄及儲存拒絕：不崩潰，顯示提示，不自動覆寫損壞資料',()=>{
  const saved=new Map([[KEY,'{broken']]);let page=browser({saved});
  assert.deepEqual(page.snapshot().state,R.initial());assert.equal(saved.get(KEY),'{broken');
  assert.match(page.$('storage-status').textContent,/無法/);
  page=browser({failRead:true});assert.deepEqual(page.snapshot().state,R.initial());
  page=browser({failWrite:true});page.click('point-a');
  assert.equal(page.snapshot().state.a,1);assert.match(page.$('storage-status').textContent,/無法/);
});
test('拒絕錯誤球員、非法得分紀錄及完局後多餘紀錄',()=>{
  assert.throws(()=>R.initial('A','B1','A1'));
  assert.throws(()=>R.replay('A','A1','B1',['C']));
  assert.throws(()=>R.replay('A','A1','B1',[...Array(21).fill('A'),'B']));
  assert.throws(()=>R.replay('A','A1','B1',null));
});
test('原有 V2 回歸測試：包含 4,080 次狀態轉換與 V1 相容性',()=>{
  require('./legacy-regression.cjs');
});
