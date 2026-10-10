const PRE = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const STEPS = 16;
const BARS = 8;
const SR = 48000;

const VOICES = ["Kick", "Snare", "Hi-hat", "Piano", "Nylon", "Upright", "Trumpet", "Violin"];
const KEYS = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const RECIPES = [
  { id: "piano-hold", name: "Piano hold", blurb: "Piano holds the chord. Nylon answers on the ands. Upright on roots." },
  { id: "nylon-chop", name: "Nylon chop", blurb: "Nylon chops every and. Piano sparse. Trumpet one note answer." },
  { id: "upright-walk", name: "Upright walk", blurb: "Upright walks the changes. Piano stabs. Violin holds the third." },
  { id: "trumpet-call", name: "Trumpet call", blurb: "Trumpet states a short call on bar 2 and 6. Piano supports." },
  { id: "violin-pad", name: "Violin pad", blurb: "Violin holds the root through the bar. Nylon and piano thin." },
  { id: "kit-pocket", name: "Kit pocket", blurb: "Tight kit. Kick on 1, snare on 2 and 4, hat on 16ths. Melodic chairs sparse." }
];

const SAMPLES = [
  ["kick", "Kick", `${PRE}/drums/kick.mp3`, 36],
  ["snare", "Snare", `${PRE}/drums/snare.mp3`, 38],
  ["hat", "Hi-hat", `${PRE}/drums/hihat.mp3`, 42],
  ["pC3", "Piano", `${PRE}/piano/C3.mp3`, 48],
  ["pE3", "Piano", `${PRE}/piano/E3.mp3`, 52],
  ["pG3", "Piano", `${PRE}/piano/G3.mp3`, 55],
  ["pA3", "Piano", `${PRE}/piano/A3.mp3`, 57],
  ["pC4", "Piano", `${PRE}/piano/C4.mp3`, 60],
  ["pE4", "Piano", `${PRE}/piano/E4.mp3`, 64],
  ["pG4", "Piano", `${PRE}/piano/G4.mp3`, 67],
  ["pA4", "Piano", `${PRE}/piano/A4.mp3`, 69],
  ["pC5", "Piano", `${PRE}/piano/C5.mp3`, 72],
  ["gE2", "Nylon", `${PRE}/guitar/E2.mp3`, 40],
  ["gA2", "Nylon", `${PRE}/guitar/A2.mp3`, 45],
  ["gB2", "Nylon", `${PRE}/guitar/B2.mp3`, 47],
  ["gD3", "Nylon", `${PRE}/guitar/D3.mp3`, 50],
  ["gE3", "Nylon", `${PRE}/guitar/E3.mp3`, 52],
  ["gG3", "Nylon", `${PRE}/guitar/G3.mp3`, 55],
  ["gA3", "Nylon", `${PRE}/guitar/A3.mp3`, 57],
  ["bE1", "Upright", `${PRE}/bass/E1.mp3`, 28],
  ["bG1", "Upright", `${PRE}/bass/G1.mp3`, 31],
  ["bA1", "Upright", `${PRE}/bass/A1.mp3`, 33],
  ["bC2", "Upright", `${PRE}/bass/C2.mp3`, 36],
  ["bE2", "Upright", `${PRE}/bass/E2.mp3`, 40],
  ["tC4", "Trumpet", `${PRE}/trumpet/C4.mp3`, 60],
  ["tE4", "Trumpet", `${PRE}/trumpet/E4.mp3`, 64],
  ["tG4", "Trumpet", `${PRE}/trumpet/G4.mp3`, 67],
  ["tA4", "Trumpet", `${PRE}/trumpet/A4.mp3`, 69],
  ["vA3", "Violin", `${PRE}/violin/A3.mp3`, 57],
  ["vC4", "Violin", `${PRE}/violin/C4.mp3`, 60],
  ["vE4", "Violin", `${PRE}/violin/E4.mp3`, 64],
  ["vG4", "Violin", `${PRE}/violin/G4.mp3`, 67],
  ["vA4", "Violin", `${PRE}/violin/A4.mp3`, 69],
  ["vC5", "Violin", `${PRE}/violin/C5.mp3`, 72]
];

const state = {
  bpm: 96,
  key: "A",
  chords: "Am F C G",
  recipe: "piano-hold",
  mode: "B",
  mutes: Object.fromEntries(VOICES.map(v => [v, false])),
  playing: false
};

let ctx, master, comp, timerId = 0, nextStepTime = 0, step = 0, sources = [];
const raw = {};
const banks = {};
let missing = [];
let armed = false;

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("fitfour-v1") || "null");
    if (!s) return;
    if (s.bpm) state.bpm = Math.max(60, Math.min(180, s.bpm));
    if (s.key) state.key = s.key;
    if (s.chords) state.chords = s.chords;
    if (s.recipe) state.recipe = s.recipe;
    if (s.mutes) Object.assign(state.mutes, s.mutes);
  } catch (e) {}
}
function saveState() {
  localStorage.setItem("fitfour-v1", JSON.stringify({
    bpm: state.bpm, key: state.key, chords: state.chords, recipe: state.recipe, mutes: state.mutes
  }));
}

const ROOTS = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6, G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };
function parseChord(token) {
  const m = String(token).trim().match(/^([A-G](?:#|b)?)(m|min)?/);
  if (!m || ROOTS[m[1]] == null) return null;
  const root = ROOTS[m[1]];
  const minor = !!m[2];
  return { symbol: m[1] + (minor ? "m" : ""), root, tones: [root, root + (minor ? 3 : 4), root + 7] };
}
function progression() {
  const parts = state.chords.split(/\s+/).filter(Boolean).slice(0, 4);
  while (parts.length < 4) parts.push(parts[parts.length - 1] || "Am");
  return parts.map(p => parseChord(p) || parseChord("Am"));
}
function keyOffset() { return ROOTS[state.key] == null ? 0 : ROOTS[state.key] - 9; }
function chordAt(bar) {
  const prog = progression();
  const ch = prog[bar % 4];
  const off = keyOffset();
  return { symbol: ch.symbol, root: (ch.root + off + 120) % 12, tones: ch.tones.map(t => (t + off + 120) % 12) };
}

function eventsAt(stepIndex) {
  const bar = Math.floor(stepIndex / 16) % BARS;
  const s = stepIndex % 16;
  const ch = chordAt(bar);
  const recipe = state.recipe;
  const b = state.mode === "B";
  const ev = [];
  if (s === 0) ev.push({ voice: "Kick", id: "kick", midi: 36, dur: 0.2, gain: 0.85 });
  if (s === 8) ev.push({ voice: "Snare", id: "snare", midi: 38, dur: 0.15, gain: 0.6 });
  if (s % 2 === 0) ev.push({ voice: "Hi-hat", id: "hat", midi: 42, dur: 0.07, gain: 0.3 });
  if (s === 0) {
    ev.push({ voice: "Upright", id: null, midi: 36 + ch.root, dur: 0.4, gain: 0.65 });
    if (!b || recipe === "kit-pocket") {
      ch.tones.forEach((t, i) => ev.push({ voice: "Piano", id: null, midi: 60 + t, dur: 0.8, gain: 0.22 - i * 0.03 }));
    }
  }
  if (b) {
    if (recipe === "piano-hold" && s === 0) {
      ch.tones.forEach((t, i) => ev.push({ voice: "Piano", id: null, midi: 60 + t, dur: 3.8, gain: 0.32 - i * 0.05, loop: true }));
      if (s === 6 || s === 10 || s === 14) ev.push({ voice: "Nylon", id: null, midi: 52 + ch.tones[1], dur: 0.25, gain: 0.4 });
    }
    if (recipe === "nylon-chop" && (s === 2 || s === 6 || s === 10 || s === 14)) {
      ev.push({ voice: "Nylon", id: null, midi: 52 + ch.tones[s % 3], dur: 0.2, gain: 0.48 });
      if (s === 0 || s === 8) ev.push({ voice: "Piano", id: null, midi: 60 + ch.tones[0], dur: 0.5, gain: 0.25 });
    }
    if (recipe === "upright-walk" && (s === 4 || s === 12)) {
      const next = chordAt((bar + 1) % BARS);
      ev.push({ voice: "Upright", id: null, midi: 36 + Math.floor((ch.root + next.root) / 2), dur: 0.3, gain: 0.55 });
      if (s === 0) ev.push({ voice: "Violin", id: null, midi: 60 + ch.tones[1], dur: 3.5, gain: 0.2, loop: true });
    }
    if (recipe === "trumpet-call" && (bar % 4 === 1 || bar % 4 === 5) && s === 0) {
      ev.push({ voice: "Trumpet", id: null, midi: 60 + ch.tones[2], dur: 1.2, gain: 0.45 });
      ch.tones.forEach((t, i) => ev.push({ voice: "Piano", id: null, midi: 60 + t, dur: 1.5, gain: 0.2 }));
    }
    if (recipe === "violin-pad" && s === 0) {
      ev.push({ voice: "Violin", id: null, midi: 60 + ch.root, dur: 3.9, gain: 0.28, loop: true });
      if (s % 4 === 0) ev.push({ voice: "Nylon", id: null, midi: 52 + ch.tones[2], dur: 0.3, gain: 0.3 });
    }
    if (recipe === "kit-pocket") {
      if (s === 4 || s === 12) ev.push({ voice: "Snare", id: "snare", midi: 38, dur: 0.12, gain: 0.45 });
    }
  }
  return ev.filter(e => !state.mutes[e.voice]);
}

function nearest(voice, midi, bankMap) {
  const bank = (bankMap || banks)[voice] || [];
  let best = null, dist = 99;
  bank.forEach(s => {
    const d = Math.abs(s.midi - midi);
    if (d < dist) { dist = d; best = s; }
  });
  if (!best || dist > 4) return null;
  return { buf: best.buf, rate: Math.pow(2, (midi - best.midi) / 12) };
}

function track(node) { sources.push(node); }
function stopSources() {
  sources.forEach(s => { try { s.stop(); } catch (e) {} });
  sources = [];
}

function scheduleHit(ctxLocal, dest, when, ev, bankMap, live) {
  const pick = nearest(ev.voice, ev.midi, bankMap);
  if (!pick) return;
  const src = ctxLocal.createBufferSource();
  src.buffer = pick.buf;
  src.playbackRate.value = pick.rate;
  if (ev.loop && pick.buf.duration > 0.4) {
    src.loop = true;
    src.loopStart = 0.15;
    src.loopEnd = Math.max(0.2, pick.buf.duration - 0.08);
  }
  const g = ctxLocal.createGain();
  const peak = ev.gain;
  const attack = ["Kick","Snare","Hi-hat"].includes(ev.voice) ? 0.001 : 0.015;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  const end = when + ev.dur;
  g.gain.setValueAtTime(peak, Math.max(when + attack, end - 0.015));
  g.gain.linearRampToValueAtTime(0.0001, end + 0.02);
  src.connect(g); g.connect(dest);
  src.start(when);
  src.stop(end + 0.04);
  if (live) track(src);
}

function scheduleStep(stepIndex, when, ctxLocal, dest, bankMap, live) {
  eventsAt(stepIndex).forEach(ev => scheduleHit(ctxLocal, dest, when, ev, bankMap, live));
}

function scheduler() {
  if (!state.playing || !ctx) return;
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime, ctx, master, banks, true);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (BARS * STEPS);
  }
}
function start(mode) {
  if (!ctx || ctx.state !== "running" || missing.length) return;
  state.mode = mode;
  state.playing = true;
  stopSources();
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  clearInterval(timerId);
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  saveState();
  paint();
}
function stop() {
  state.playing = false;
  clearInterval(timerId);
  stopSources();
  paint();
}

let raf = 0;
function playhead() {
  if (ctx && state.playing) {
    const stepDur = 60 / state.bpm / 4;
    const origin = nextStepTime - step * stepDur;
    const pos = Math.max(0, ctx.currentTime - origin);
    const bar = Math.floor(pos / (stepDur * 16)) % BARS;
    document.querySelectorAll(".bar").forEach((el, i) => el.classList.toggle("active", i === bar));
  }
  raf = requestAnimationFrame(playhead);
}

function exportLength(bars, bpm) {
  return Math.round(bars * 4 * 60 / bpm * SR);
}
async function renderOffline(withTail) {
  const bars = BARS;
  const bpm = state.bpm;
  const length = exportLength(bars, bpm);
  const tail = Math.round(SR * 1.2);
  const off = new OfflineAudioContext(2, length + tail, SR);
  const bus = off.createGain();
  bus.gain.value = 0.75;
  const lim = off.createDynamicsCompressor();
  lim.threshold.value = -6;
  lim.knee.value = 4;
  lim.ratio.value = 6;
  lim.attack.value = 0.002;
  lim.release.value = 0.1;
  bus.connect(lim); lim.connect(off.destination);
  const offlineBanks = {};
  for (const [id, voice, url, midi] of SAMPLES) {
    if (!raw[id]) throw new Error("Missing raw sample for " + voice);
    const buf = await off.decodeAudioData(raw[id].slice(0));
    offlineBanks[voice] = offlineBanks[voice] || [];
    offlineBanks[voice].push({ id, midi, buf });
  }
  const stepDur = 60 / bpm / 4;
  let t = 0;
  for (let i = 0; i < bars * STEPS; i++) {
    scheduleStep(i, t, off, bus, offlineBanks, false);
    t += stepDur;
  }
  const rendered = await off.startRendering();
  const mix = rendered.getChannelData(0).slice(0, length + tail);
  const right = rendered.getChannelData(1).slice(0, length + tail);
  if (!withTail) {
    for (let i = 0; i < tail; i++) {
      mix[i % length] += mix[length + i] || 0;
      right[i % length] += right[length + i] || 0;
    }
  }
  const n = withTail ? length + tail : length;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mix[i] || 0), Math.abs(right[i] || 0));
  const gain = peak > 0 ? Math.min(1, Math.pow(10, -1 / 20) / peak) : 1;
  return encodeWav(mix, right, n, gain);
}
function encodeWav(l, r, n, gain) {
  const bytes = 44 + n * 6;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, bytes - 8, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 6, true); v.setUint16(32, 6, true); v.setUint16(34, 24, true);
  w(36, "data"); v.setUint32(40, n * 6, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const ls = Math.max(-8388608, Math.min(8388607, Math.round((l[i] || 0) * gain * 8388607)));
    const rs = Math.max(-8388608, Math.min(8388607, Math.round((r[i] || 0) * gain * 8388607)));
    v.setInt8(o, ls & 0xff); v.setInt8(o+1, (ls >> 8) & 0xff); v.setInt8(o+2, (ls >> 16) & 0xff);
    v.setInt8(o+3, rs & 0xff); v.setInt8(o+4, (rs >> 8) & 0xff); v.setInt8(o+5, (rs >> 16) & 0xff);
    o += 6;
  }
  return ab;
}

function midiExport() {
  const bpm = state.bpm;
  const ticksPerBeat = 480;
  const stepTicks = ticksPerBeat / 4;
  const tracks = [];
  VOICES.forEach(voice => {
    if (state.mutes[voice]) return;
    const notes = [];
    for (let i = 0; i < BARS * STEPS; i++) {
      eventsAt(i).filter(e => e.voice === voice).forEach(ev => {
        notes.push({ tick: i * stepTicks, midi: ev.midi, dur: Math.round(ev.dur * (bpm / 60) * ticksPerBeat), vel: Math.round(ev.gain * 100) });
      });
    }
    if (notes.length) tracks.push({ voice, notes });
  });
  const header = new Uint8Array([0x4d,0x54,0x68,0x64, 0,0,0,6, 0,1, 0,tracks.length+1, (ticksPerBeat>>8)&0xff, ticksPerBeat&0xff]);
  function trackBytes(events) {
    const data = [];
    let last = 0;
    events.forEach(e => {
      const delta = e.tick - last;
      last = e.tick;
      let d = delta;
      const bytes = [];
      bytes.push(d & 0x7f);
      while (d > 0x7f) { d >>= 7; bytes.push((d & 0x7f) | 0x80); }
      for (let i = bytes.length-1; i>=0; i--) data.push(bytes[i]);
      data.push(0x90, e.midi, e.vel);
      const endTick = e.tick + e.dur;
      const d2 = endTick - last;
      last = endTick;
      let dd = d2;
      const b2 = [];
      b2.push(dd & 0x7f);
      while (dd > 0x7f) { dd >>= 7; b2.push((dd & 0x7f) | 0x80); }
      for (let i = b2.length-1; i>=0; i--) data.push(b2[i]);
      data.push(0x80, e.midi, 0);
    });
    data.push(0x00, 0xff, 0x2f, 0x00);
    const len = data.length;
    const trk = new Uint8Array(8 + len);
    trk.set([0x4d,0x54,0x72,0x6b, (len>>24)&0xff, (len>>16)&0xff, (len>>8)&0xff, len&0xff]);
    trk.set(data, 8);
    return trk;
  }
  const us = Math.round(60000000 / bpm);
  const tempoData = [0x00, 0xff, 0x51, 0x03, (us>>16)&0xff, (us>>8)&0xff, us&0xff, 0x00, 0xff, 0x2f, 0x00];
  const tempoTrk = new Uint8Array(8 + tempoData.length);
  tempoTrk.set([0x4d,0x54,0x72,0x6b, 0,0,0,tempoData.length]);
  tempoTrk.set(tempoData, 8);
  const parts = [header, tempoTrk];
  tracks.forEach(t => parts.push(trackBytes(t.notes)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  parts.forEach(p => { out.set(p, off); off += p.length; });
  return out;
}

async function doExport() {
  const name = `fitfour-recipe-${state.bpm}bpm-${state.key}.wav`;
  const wav = await renderOffline(false);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  a.download = name;
  a.click();
  const mid = midiExport();
  const b = document.createElement("a");
  b.href = URL.createObjectURL(new Blob([mid], { type: "audio/midi" }));
  b.download = name.replace(".wav", ".mid");
  b.click();
}

function paint() {
  document.getElementById("bpm").value = state.bpm;
  document.getElementById("key").value = state.key;
  document.getElementById("chords").value = state.chords;
  const rec = document.getElementById("recipes");
  rec.innerHTML = "";
  RECIPES.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.recipe === r.id ? " on" : "");
    btn.textContent = r.name;
    btn.onclick = () => { state.recipe = r.id; saveState(); paint(); };
    rec.appendChild(btn);
  });
  const mut = document.getElementById("mutes");
  mut.innerHTML = "";
  VOICES.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.mutes[v] ? "" : " on");
    btn.textContent = (state.mutes[v] ? "✕ " : "") + v;
    btn.onclick = () => { state.mutes[v] = !state.mutes[v]; saveState(); paint(); };
    mut.appendChild(btn);
  });
  const bars = document.getElementById("bars");
  bars.innerHTML = "";
  for (let i = 0; i < BARS; i++) {
    const el = document.createElement("div");
    el.className = "bar";
    el.textContent = (i+1) + " " + chordAt(i).symbol;
    bars.appendChild(el);
  }
  const recipe = RECIPES.find(r => r.id === state.recipe);
  document.getElementById("punch").textContent = recipe ? recipe.blurb + "\n\nDrop the WAV on bar 1 of a " + state.bpm + " BPM session. MIDI has one track per chair." : "";
  document.getElementById("status").textContent = missing.length ? "Missing: " + missing.join(", ") : (armed ? "Ready" : "Tap to start audio");
}

async function load() {
  loadState();
  paint();
  document.getElementById("status").textContent = "Loading samples…";
  missing = [];
  let loaded = 0;
  for (const [id, voice, url, midi] of SAMPLES) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fail");
      const buf = await r.arrayBuffer();
      raw[id] = buf;
      loaded++;
      document.getElementById("status").textContent = `Loading ${loaded}/${SAMPLES.length}`;
    } catch (e) {
      missing.push(voice);
    }
  }
  if (missing.length) {
    document.getElementById("status").textContent = "Missing: " + [...new Set(missing)].join(", ");
    return;
  }
  const temp = new AudioContext();
  for (const [id, voice, url, midi] of SAMPLES) {
    const buf = await temp.decodeAudioData(raw[id].slice(0));
    banks[voice] = banks[voice] || [];
    banks[voice].push({ id, midi, buf });
  }
  temp.close();
  document.getElementById("status").textContent = "Tap to start audio";
  paint();
}

function arm() {
  if (armed) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.7;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.ratio.value = 4;
  master.connect(comp);
  comp.connect(ctx.destination);
  armed = true;
  document.getElementById("status").textContent = "Ready";
  playhead();
}

document.getElementById("playA").onclick = () => { arm(); start("A"); };
document.getElementById("playB").onclick = () => { arm(); start("B"); };
document.getElementById("stop").onclick = stop;
document.getElementById("export").onclick = doExport;
document.getElementById("bpm").onchange = e => { state.bpm = Math.max(60, Math.min(180, +e.target.value)); saveState(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; saveState(); paint(); };
document.getElementById("chords").onchange = e => { state.chords = e.target.value; saveState(); paint(); };

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.playing) stop();
});

load();
