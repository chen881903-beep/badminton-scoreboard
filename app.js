"use strict";
const KEY = "badminton_web.match.v2";
const $ = id => document.getElementById(id);
const players = ["A1","A2","B1","B2"];
let names = Object.fromEntries(players.map(id => [id,id]));
let first = "A", firstServer = "A1", firstReceiver = "B1";
let history = [], state = Scoring.initial(), storageOK = true, notice = "";
try {
  const raw = localStorage.getItem(KEY);
  const legacy = raw ? null : localStorage.getItem("badminton_web.match.v1");
  if (raw || legacy) {
    const data = JSON.parse(raw || legacy);
    if (raw ? data.version !== 2 : data.version !== 1) throw Error("Invalid version");
    const openingServer = raw ? data.firstServer : data.first+"1";
    const openingReceiver = raw ? data.firstReceiver : (data.first === "A" ? "B1" : "A1");
    const restored = Scoring.replay(data.first,openingServer,openingReceiver,data.rallies);
    first = data.first; firstServer = openingServer; firstReceiver = openingReceiver;
    state = restored.state; history = restored.history;
    if (raw && data.names) for (const id of players) {
      if (typeof data.names[id] !== "string" || data.names[id].length > 24) throw Error("Invalid name");
      names[id] = data.names[id].trim() || id;
    }
    if (raw && typeof data.notice === "string") notice = data.notice;
    if (legacy) notice = "已保留 V1 比分；舊版沒有球員紀錄，暫以每隊 1 號首發／首接推算站位。可重新開始設定。";
  }
} catch {
  first = "A"; firstServer = "A1"; firstReceiver = "B1";
  state = Scoring.initial(); history = []; storageOK = false;
  notice = "未能讀取原有紀錄，現顯示新局；原紀錄未被覆寫。";
}
function save() {
  try {
    const all = [...history,state];
    const rallies = history.map((s,i) => all[i+1].a > s.a ? "A" : "B");
    localStorage.setItem(KEY,JSON.stringify({version:2,first,firstServer,firstReceiver,names,rallies,notice}));
    storageOK = true;
  } catch { storageOK = false; }
}
function playerLabel(id) { return names[id] === id ? id : names[id]+" ("+id+")"; }
function options(id,team,selected) {
  const select = $(id); select.replaceChildren();
  for (const player of [team+"1",team+"2"]) {
    const option = document.createElement("option");
    option.value = player; option.textContent = playerLabel(player); select.append(option);
  }
  select.value = selected; select.disabled = history.length > 0;
}
function render() {
  const win = Scoring.winner(state), service = Scoring.service(state);
  $("score-a").textContent = state.a; $("score-b").textContent = state.b;
  for (const team of ["A","B"]) {
    const id = team.toLowerCase();
    $("card-"+id).classList.toggle("serving",!win && state.server === team);
    $("badge-"+id).textContent = win === team ? "本局勝出" : (!win && state.server === team ? "發球中" : "");
    $("point-"+id).disabled = Boolean(win);
    $("first-"+id).disabled = history.length > 0;
    $("first-"+id).setAttribute("aria-pressed",String(first === team));
    for (const side of ["left","right"]) {
      const player = state.positions[team][side], cell = $("position-"+id+"-"+side);
      cell.textContent = playerLabel(player)+(!win && service.server === player ? " · 發球" : !win && service.receiver === player ? " · 接發球" : "");
      cell.classList.toggle("active-server",!win && service.server === player);
      cell.classList.toggle("active-receiver",!win && service.receiver === player);
    }
  }
  options("opening-server",first,firstServer);
  options("opening-receiver",first === "A" ? "B" : "A",firstReceiver);
  $("status").textContent = win ? "本局結束 · "+win+" 隊勝出！ "+state.a+" : "+state.b : state.server+" 隊發球 · "+Scoring.court(state)+"邊發球區｜"+playerLabel(service.server)+" 發球 → "+playerLabel(service.receiver)+" 接發球";
  $("setup-hint").textContent = history.length ? "重新開始可更改首發／首接球員" : "第一球前可更改首發／首接球員";
  $("undo").disabled = history.length === 0;
  $("migration-note").textContent = notice;
  $("storage-status").textContent = storageOK ? "比分、球員站位及撤銷紀錄自動儲存在此瀏覽器" : "暫時無法讀取或儲存紀錄，請勿關閉或重新整理網頁。";
}
for (const id of players) {
  $("name-"+id).value = names[id];
  $("name-"+id).addEventListener("change",() => {
    names[id] = $("name-"+id).value.trim().slice(0,24) || id;
    $("name-"+id).value = names[id]; save(); render();
  });
}
for (const team of ["A","B"]) {
  $("point-"+team.toLowerCase()).addEventListener("click",() => {
    if (Scoring.winner(state)) return;
    history.push(state); state = Scoring.point(state,team); $("prematch-settings").open = false; save(); render();
  });
  $("first-"+team.toLowerCase()).addEventListener("click",() => {
    if (history.length) return;
    if (first !== team) [firstServer,firstReceiver] = [firstReceiver,firstServer];
    first = team; state = Scoring.initial(first,firstServer,firstReceiver); save(); render();
  });
}
for (const id of ["opening-server","opening-receiver"]) $(id).addEventListener("change",() => {
  if (history.length) return;
  firstServer = $("opening-server").value; firstReceiver = $("opening-receiver").value;
  state = Scoring.initial(first,firstServer,firstReceiver); save(); render();
});
$("undo").addEventListener("click",() => { if (history.length) { ({state,history} = Scoring.undo(state,history)); save(); render(); } });
$("restart").addEventListener("click",() => {
  if (history.length && !confirm("確定清除本局比分及站位，重新開始？")) return;
  ({state,history} = Scoring.reset(first,firstServer,firstReceiver)); notice = ""; save(); render();
  $("prematch-settings").open = true;
});
$("confirm-setup").addEventListener("click",() => {
  $("prematch-settings").open = false;
});
$("prematch-settings").open = history.length === 0;
render();
