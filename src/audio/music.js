// "NEON GRID": procedural chiptune / synthwave soundtrack (ported from the canvas build).
import { ensureAC, audioCtx } from './sfx.js';

const MUSIC_VOL=.28, MUSIC_DUCK=.11, MUSIC_TITLE=.07;   // music sits under the sound effects; barely there on the title
const MUSIC={started:false,muted:false,step:0,next:0,bpm:144,tr:0,mode:'title',timer:null,master:null,arpBus:null,padBus:null,leadBus:null,dl:null};
const mf=m=>440*Math.pow(2,(m+MUSIC.tr-69)/12);   // tr = per-level transposition

// 8-bar progression in A minor: Am F C G | Am F Dm E   (root midi, chord intervals)
const PROG=[[57,[0,3,7]],[53,[0,4,7]],[48,[0,4,7]],[55,[0,4,7]],[57,[0,3,7]],[53,[0,4,7]],[50,[0,3,7]],[52,[0,4,7]]];
// lead melody, eighth notes per bar (0 = rest), two 8-bar phrases
const LEAD_A=[[76,76,0,81,79,0,76,74],[77,0,77,76,74,0,72,74],[76,0,72,76,79,0,81,79],[83,0,79,0,76,74,71,0],
              [81,0,81,83,84,0,83,81],[79,0,77,0,76,77,79,0],[81,0,77,74,77,0,81,0],[80,0,80,0,76,0,0,0]];
const LEAD_B=[[88,0,86,84,81,0,84,0],[84,0,81,0,77,79,81,0],[79,0,84,0,88,86,84,0],[86,0,83,0,79,0,74,76],
              [81,84,88,0,86,0,84,83],[81,0,79,0,77,0,76,0],[74,0,77,0,81,0,84,0],[80,0,83,0,88,0,0,0]];
const BASS_PAT=[0,0,12,0, 0,12,0,0, 0,0,12,0, 7,0,12,0];
const KICK_PAT=[1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0], SNARE_PAT=[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
export function musicStart(){
  try{
    const AC=ensureAC();
    if(AC.state==='suspended') AC.resume();
    if(MUSIC.started) return;
    const comp=AC.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=4; comp.connect(AC.destination);
    MUSIC.master=AC.createGain(); MUSIC.master.gain.value=MUSIC.muted?0:modeLevel(); MUSIC.master.connect(comp);
    // arp bus with a dotted-eighth echo (the Tron shimmer)
    MUSIC.arpBus=AC.createGain(); MUSIC.arpBus.gain.value=.5; MUSIC.arpBus.connect(MUSIC.master);
    const dl=AC.createDelay(1); MUSIC.dl=dl; dl.delayTime.value=60/MUSIC.bpm*.75; const fb=AC.createGain(); fb.gain.value=.38; const dlp=AC.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value=2600;
    MUSIC.arpBus.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(MUSIC.master);
    MUSIC.padBus=AC.createGain(); MUSIC.padBus.gain.value=1; MUSIC.padBus.connect(MUSIC.master);
    MUSIC.leadBus=AC.createGain(); MUSIC.leadBus.gain.value=.8; MUSIC.leadBus.connect(MUSIC.master); MUSIC.leadBus.connect(dl);
    MUSIC.next=AC.currentTime+.08; MUSIC.step=0; MUSIC.started=true;
    MUSIC.timer=setInterval(musicTick,25);
  }catch(e){}
}
function musicTick(){ const AC=audioCtx(); const spb=60/MUSIC.bpm/4; while(MUSIC.next<AC.currentTime+.18){ scheduleStep(MUSIC.step,MUSIC.next,spb); MUSIC.next+=spb; MUSIC.step++; } }
function musicLevel(v){ if(MUSIC.master&&!MUSIC.muted) MUSIC.master.gain.setTargetAtTime(v,audioCtx().currentTime,.3); }
function modeLevel(){ return MUSIC.mode==='title'?MUSIC_TITLE:MUSIC.mode==='duck'?MUSIC_DUCK:MUSIC_VOL; }
// mode: 'title' (barely there), 'play' (full), 'duck' (under menus / game over)
export function musicMode(mode){ MUSIC.mode=mode; musicLevel(modeLevel()); }
export function musicMuted(){ return MUSIC.muted; }
// each level gets its own key and tempo
export function musicSetLevel(bpm,tr){
  MUSIC.bpm=bpm; MUSIC.tr=tr;
  if(MUSIC.dl) MUSIC.dl.delayTime.setTargetAtTime(60/bpm*.75,audioCtx().currentTime,.05);
}
export function musicToggle(){ MUSIC.muted=!MUSIC.muted; if(MUSIC.master) MUSIC.master.gain.setTargetAtTime(MUSIC.muted?0:modeLevel(),audioCtx().currentTime,.05); }
function osc(type,freq,t,dur,vol,dest,o={}){
  const AC=audioCtx();
  const v=AC.createOscillator(), g=AC.createGain(); v.type=type; v.frequency.setValueAtTime(freq,t);
  if(o.detune) v.detune.value=o.detune; if(o.slide) v.frequency.exponentialRampToValueAtTime(o.slide,t+dur);
  let node=v; if(o.lp){ const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(o.lp,t); if(o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd,t+dur); f.Q.value=o.q||1; v.connect(f); node=f; }
  const a=o.attack||.005; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+a); g.gain.setValueAtTime(vol,t+Math.max(a,dur-(o.rel||.03))); g.gain.linearRampToValueAtTime(0,t+dur);
  node.connect(g).connect(dest); v.start(t); v.stop(t+dur+.02);
  if(o.vib){ const l=AC.createOscillator(), lg=AC.createGain(); l.frequency.value=5.5; lg.gain.value=o.vib; l.connect(lg).connect(v.frequency); l.start(t+.08); l.stop(t+dur); }
}
function noise(t,dur,vol,dest,hp,lp){
  const AC=audioCtx();
  const len=Math.ceil(AC.sampleRate*dur), b=AC.createBuffer(1,len,AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const src=AC.createBufferSource(); src.buffer=b; const h=AC.createBiquadFilter(); h.type='highpass'; h.frequency.value=hp; const l=AC.createBiquadFilter(); l.type='lowpass'; l.frequency.value=lp;
  const g=AC.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); src.connect(h).connect(l).connect(g).connect(dest); src.start(t); src.stop(t+dur);
}
function scheduleStep(step,t,spb){
  const s16=step%16, bar=Math.floor(step/16), barIn8=bar%8, sect=Math.floor(bar/8)%4;   // 4 sections of 8 bars, loops
  const [root,iv]=PROG[barIn8], M=MUSIC.master;
  // drums (Contra drive) — intro section is lighter
  if(KICK_PAT[s16] && sect!==0){ osc('sine',150,t,.22,.9,M,{slide:38}); noise(t,.04,.35,M,60,900); }
  if(SNARE_PAT[s16] && sect!==0 && !(s16===15&&bar%2===0)){ noise(t,.14,.5,M,900,6000); osc('triangle',190,t,.08,.4,M,{slide:120}); }
  if(s16%2===0) noise(t,.03,sect===0?.08:.14,M,7000,14000); else if(s16%4===3) noise(t,.07,.1,M,6000,12000);
  // bass: driving 16ths with octave pops
  const bn=root-12+BASS_PAT[s16]; if(sect!==0||s16%4===0) osc('square',mf(bn),t,spb*.9,.28,M,{lp:900,lpEnd:300,q:2});
  osc('sawtooth',mf(bn-12),t,spb*.9,.12,M,{lp:260});
  // arps: chord tones climbing two octaves (Tron / Joust sparkle)
  const tones=[iv[0],iv[1],iv[2],iv[0]+12,iv[1]+12,iv[2]+12,iv[0]+24,iv[2]+12]; const ai=(sect===3? (7-s16%8) : s16%8);
  osc(sect>=2?'square':'triangle',mf(root+12+tones[ai]),t,spb*.7,sect===0?.12:.16,MUSIC.arpBus);
  // pad: detuned saws per bar
  if(s16===0){ for(const n of iv){ const f=mf(root+n); osc('sawtooth',f,t,spb*16,.035,MUSIC.padBus,{detune:-9,attack:.25,rel:.4,lp:1100}); osc('sawtooth',f,t,spb*16,.035,MUSIC.padBus,{detune:9,attack:.25,rel:.4,lp:1100}); } }
  // lead: sections 1 and 3 (phrase A then phrase B), square with vibrato
  if((sect===1||sect===3) && s16%2===0){
    const ph=sect===1?LEAD_A:LEAD_B, n=ph[barIn8][s16/2];
    if(n){ // hold until next note or rest
      let len=1; for(let k=s16/2+1;k<8&&ph[barIn8][k]===0;k++) len++;
      osc('square',mf(n),t,spb*2*len*.92,.17,MUSIC.leadBus,{vib:4,lp:3200,attack:.01,rel:.06});
      osc('square',mf(n-12),t,spb*2*len*.92,.05,MUSIC.leadBus,{detune:6,lp:1800});
    }
  }
  // Joust-style quirky fill at the end of sections 1 and 3
  if(barIn8===7 && (sect===1||sect===3) && s16>=12){ osc('square',mf(root+36-(15-s16)*2),t,spb*.8,.1,MUSIC.arpBus,{slide:mf(root+36-(15-s16)*2)*1.5}); }
}

// ---------------------------------------------------------------- input
