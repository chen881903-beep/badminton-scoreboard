/* Dependency-free doubles rules; court sides are each team's view facing the net. */
(function (root) {
  "use strict";
  function initial(first = "A", firstServer = first + "1", firstReceiver = (first === "A" ? "B" : "A") + "1") {
    const other = first === "A" ? "B" : "A";
    if (!["A", "B"].includes(first) || ![first+"1", first+"2"].includes(firstServer) || ![other+"1", other+"2"].includes(firstReceiver)) throw Error("Invalid opening players");
    const positions = {};
    for (const [team, right] of [[first, firstServer], [other, firstReceiver]]) positions[team] = {right, left:team+(right.endsWith("1") ? "2" : "1")};
    return {a:0, b:0, server:first, positions};
  }
  function winner(s) {
    if (Math.max(s.a,s.b) === 30 || (Math.max(s.a,s.b) >= 21 && Math.abs(s.a-s.b) >= 2)) return s.a > s.b ? "A" : "B";
    return null;
  }
  function point(s, team) {
    if (winner(s) || !["A","B"].includes(team)) return s;
    const positions = {A:{...s.positions.A}, B:{...s.positions.B}};
    if (team === s.server) [positions[team].left, positions[team].right] = [positions[team].right, positions[team].left];
    return {a:s.a+(team === "A" ? 1 : 0), b:s.b+(team === "B" ? 1 : 0), server:team, positions};
  }
  function court(s) { return (s.server === "A" ? s.a : s.b) % 2 === 0 ? "右" : "左"; }
  function service(s) {
    const side = court(s) === "右" ? "right" : "left";
    const other = s.server === "A" ? "B" : "A";
    return {side, server:s.positions[s.server][side], receiver:s.positions[other][side]};
  }
  function replay(first, firstServer, firstReceiver, rallies) {
    if (!Array.isArray(rallies) || rallies.length > 59) throw Error("Invalid rallies");
    let state = initial(first, firstServer, firstReceiver);
    const history = [];
    for (const team of rallies) {
      if (!["A","B"].includes(team) || winner(state)) throw Error("Invalid rally");
      history.push(state); state = point(state,team);
    }
    return {state,history};
  }
  // Return new containers so undo/reset never modifies existing snapshots.
  function undo(state, history) {
    return history.length ? {state:history[history.length-1], history:history.slice(0,-1)} : {state, history:[]};
  }
  function reset(first = "A", firstServer = first+"1", firstReceiver = (first === "A" ? "B" : "A")+"1") {
    return {state:initial(first,firstServer,firstReceiver), history:[]};
  }
  const rules = {initial,winner,point,court,service,replay,undo,reset};
  if (typeof module !== "undefined" && module.exports) module.exports = rules;
  else root.Scoring = rules;
})(typeof globalThis !== "undefined" ? globalThis : this);
