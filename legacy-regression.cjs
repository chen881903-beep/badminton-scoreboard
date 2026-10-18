// Optional developer check: node test.cjs (the webpage itself needs no Node.js).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Scoring = require('./scoring.js');
let s = Scoring.initial('B');
assert.equal(Scoring.court(s), '右');
s = Scoring.point(s, 'B');
assert.equal(s.server, 'B'); assert.equal(Scoring.court(s), '左');
s = Scoring.point(s, 'A');
assert.equal(s.server, 'A'); assert.equal(Scoring.court(s), '左');
for (let a = 0; a <= 30; a++) for (let b = 0; b <= 30; b++) {
  if (a === b && a === 30) continue;
  const expected = Math.max(a,b) === 30 || (Math.max(a,b) >= 21 && Math.abs(a-b) >= 2);
  assert.equal(Boolean(Scoring.winner({a,b})), expected);
}
assert.equal(Scoring.winner({a:21,b:20}), null);
assert.equal(Scoring.winner({a:22,b:20}), 'A');
assert.equal(Scoring.winner({a:30,b:29}), 'A');
const ended = {a:30,b:29,server:'A'};
assert.equal(Scoring.point(ended,'B'), ended);
// Exercise the actual UI handlers with a minimal DOM and persistent storage.
const saved = new Map();
function page(failStorage = false) {
  const elements = new Map();
  const document = {createElement(){return {};},getElementById(id) {
    if (!elements.has(id)) elements.set(id, {classList:{toggle(){}},replaceChildren(){},append(){},setAttribute(){},addEventListener(event, handler){this[event] = handler;}});
    return elements.get(id);
  }};
  const context = {Scoring, document, confirm:()=>true, localStorage:{getItem:k=>saved.get(k),setItem(k,v){if(failStorage) throw Error('storage disabled'); saved.set(k,v);}}};
  vm.runInNewContext(fs.readFileSync(__dirname + '/app.js','utf8'), context);
  return id => document.getElementById(id);
}
let ui = page();
ui('first-b').click(); ui('point-b').click(); ui('point-a').click();
assert.match(ui('status').textContent, /A 隊發球 · 左/);
ui = page();
assert.equal(ui('score-a').textContent, 1); assert.equal(ui('score-b').textContent, 1);
ui('undo').click();
assert.match(ui('status').textContent, /B 隊發球 · 左/);
ui('restart').click();
assert.equal(ui('score-b').textContent, 0);
for(let i=0;i<21;i++) ui('point-a').click();
assert.equal(ui('point-b').disabled, true);
ui('undo').click();
assert.equal(ui('point-b').disabled, false);
assert.equal(ui('score-a').textContent, 20);
ui = page(); assert.equal(ui('score-a').textContent, 20);
saved.set('badminton_web.match.v2', '{broken');
ui = page(); assert.equal(ui('score-a').textContent, 0);
ui = page(true); ui('point-a').click();
assert.match(ui('storage-status').textContent, /無法/);
console.log('PASS: scoring, service, deuce, cap, undo, restart, persistence and storage failure');

// Known doubles sequence, independently specified positions and service pairs.
s = Scoring.initial('A','A1','B1');
const sequence = [
  // winner, A-right, A-left, B-right, B-left, server, receiver
  ['A','A2','A1','B1','B2','A1','B2'],
  ['A','A1','A2','B1','B2','A1','B1'],
  ['B','A1','A2','B1','B2','B2','A2'],
  ['B','A1','A2','B2','B1','B2','A1'],
  ['A','A1','A2','B2','B1','A2','B1'],
  ['B','A1','A2','B2','B1','B1','A2'],
  ['A','A1','A2','B2','B1','A1','B2'],
];
const snapshots = [];
for (const [team,ar,al,br,bl,server,receiver] of sequence) {
  const old = JSON.stringify(s); snapshots.push(s);
  s = Scoring.point(s,team);
  assert.equal(JSON.stringify(snapshots.at(-1)),old,'point must not mutate undo snapshot');
  assert.deepEqual(s.positions,{A:{right:ar,left:al},B:{right:br,left:bl}});
  assert.equal(Scoring.service(s).server,server); assert.equal(Scoring.service(s).receiver,receiver);
}
for (let i=sequence.length-1;i>=0;i--) {
  s = snapshots.pop();
  assert.deepEqual(s,Scoring.replay('A','A1','B1',sequence.slice(0,i).map(row=>row[0])).state);
}
// All eight initial selections, both score outcomes at every node, depth eight.
let transitions = 0;
function explore(current,depth) {
  if (!depth) return;
  for (const team of ['A','B']) {
    const before = JSON.stringify(current), next = Scoring.point(current,team);
    const prevService = Scoring.service(current), nextService = Scoring.service(next);
    assert.equal(JSON.stringify(current),before);
    assert.equal(nextService.side,(team==='A'?next.a:next.b)%2 ? 'left':'right');
    if (team === current.server) {
      assert.equal(nextService.server,prevService.server);
      assert.equal(next.positions[team].left,current.positions[team].right);
      const other = team==='A'?'B':'A';
      assert.deepEqual(next.positions[other],current.positions[other]);
    } else assert.deepEqual(next.positions,current.positions);
    transitions++; explore(next,depth-1);
  }
}
for (const team of ['A','B']) for (const n of ['1','2']) for (const m of ['1','2']) {
  const other = team==='A'?'B':'A';
  const start = Scoring.initial(team,team+n,other+m);
  assert.equal(Scoring.service(start).server,team+n);
  assert.equal(Scoring.service(start).receiver,other+m);
  explore(start,8);
}
console.log('PASS: known doubles sequence, full snapshot undo and '+transitions+' service transitions');

saved.clear(); ui = page();
ui('opening-server').value='A2'; ui('opening-receiver').value='B2'; ui('opening-server').change();
ui('name-A2').value='小明'; ui('name-A2').change();
ui('point-a').click(); ui('point-a').click(); ui('point-b').click();
const snapshotIds = ['score-a','score-b','status','position-a-left','position-a-right','position-b-left','position-b-right'];
const snapshot = () => snapshotIds.map(id=>ui(id).textContent);
const expected = snapshot();
ui('point-b').click(); ui('undo').click(); assert.deepEqual(snapshot(),expected);
ui = page(); assert.deepEqual(snapshot(),expected);
ui('point-b').click(); ui = page(); ui('undo').click(); assert.deepEqual(snapshot(),expected);
assert.equal(ui('name-A2').value,'小明');
assert.equal(ui('opening-server').disabled,true);
ui('restart').click(); assert.equal(ui('opening-server').value,'A2'); assert.equal(ui('opening-server').disabled,false);
ui('first-b').click(); assert.equal(ui('opening-server').value,'B2'); assert.equal(ui('opening-receiver').value,'A2');
saved.clear(); saved.set('badminton_web.match.v1',JSON.stringify({version:1,first:'B',rallies:['B','A','A']}));
ui = page(); assert.equal(ui('score-a').textContent,2); assert.equal(ui('score-b').textContent,1);
assert.match(ui('migration-note').textContent,/V1/);
ui('point-b').click(); ui=page(); assert.match(ui('migration-note').textContent,/V1/);
assert.ok(saved.has('badminton_web.match.v1'),'original V1 record remains');
assert.throws(()=>Scoring.replay('A','A1','B1',[...Array(21).fill('A'),'B']));
assert.throws(()=>Scoring.initial('A','B1','A1'));
console.log('PASS: custom players/names, UI undo/reload/undo after reload, opening lock, restart, V1 migration and invalid data');
