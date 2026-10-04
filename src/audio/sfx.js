// Tiny WebAudio synth: every sound effect is generated in code (ported from the canvas build).
let AC = null;
export const audioCtx = () => AC;
export function ensureAC(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); return AC; }
// continuous jet thruster: filtered noise + low rumble, gain ramps on/off
let THR=null;
export function thruster(on){
  on=on|0;
  try{
    if(!AC){ if(!on) return; ensureAC(); }
    if(!THR){
      const len=AC.sampleRate*2, buf=AC.createBuffer(1,len,AC.sampleRate), d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      const noise=AC.createBufferSource(); noise.buffer=buf; noise.loop=true;
      const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=900; bp.Q.value=.7;
      const rum=AC.createOscillator(); rum.type='sawtooth'; rum.frequency.value=70;
      const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=220;
      const lfo=AC.createOscillator(); lfo.frequency.value=9; const lfoG=AC.createGain(); lfoG.gain.value=6; lfo.connect(lfoG).connect(rum.frequency);
      const g=AC.createGain(); g.gain.value=0;
      noise.connect(bp).connect(g); rum.connect(lp).connect(g); g.connect(AC.destination);
      noise.start(); rum.start(); lfo.start();
      THR={g,bp,on:false};
    }
    // level: 0 = off, 1 = jet engaged (idle hum), 2 = thrusting (full roar)
    if(on!==THR.on){ THR.on=on; const t=AC.currentTime; THR.g.gain.cancelScheduledValues(t); THR.g.gain.setTargetAtTime([0,.055,.16][on], t, on?.06:.12); }
    if(on) THR.bp.frequency.value=(on===2?800:420)+Math.random()*(on===2?300:80);   // flicker, deeper when idling
  }catch(e){}
}
// tone with optional delay, wave, filter, slide and vibrato (richer than beep)
function tone(o){
  try{
    ensureAC();
    const t=AC.currentTime+(o.at||0), v=AC.createOscillator(), g=AC.createGain(); v.type=o.type||'sine';
    v.frequency.setValueAtTime(o.f,t); if(o.to) v.frequency.exponentialRampToValueAtTime(Math.max(20,o.to),t+o.dur);
    if(o.bend){ for(const [k,f] of o.bend) v.frequency.linearRampToValueAtTime(f,t+o.dur*k); }
    let n=v; if(o.lp){ const fl=AC.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=o.lp; fl.Q.value=o.q||1; v.connect(fl); n=fl; }
    const a=o.attack||.004, vol=o.vol||.08;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+a); g.gain.setValueAtTime(vol,t+Math.max(a,o.dur*.6)); g.gain.exponentialRampToValueAtTime(.0005,t+o.dur);
    n.connect(g).connect(AC.destination); v.start(t); v.stop(t+o.dur+.02);
    if(o.vib){ const l=AC.createOscillator(), lg=AC.createGain(); l.frequency.value=o.vibHz||18; lg.gain.value=o.vib; l.connect(lg).connect(v.frequency); l.start(t); l.stop(t+o.dur); }
  }catch(e){}
}
function hiss(o){  // filtered noise burst
  try{
    ensureAC();
    const t=AC.currentTime+(o.at||0), len=Math.ceil(AC.sampleRate*o.dur), b=AC.createBuffer(1,len,AC.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    const src=AC.createBufferSource(); src.buffer=b; const f=AC.createBiquadFilter(); f.type=o.type||'bandpass'; f.frequency.setValueAtTime(o.f,t); if(o.to) f.frequency.exponentialRampToValueAtTime(o.to,t+o.dur); f.Q.value=o.q||1;
    const g=AC.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(o.vol||.1,t+(o.attack||.01)); g.gain.exponentialRampToValueAtTime(.0005,t+o.dur);
    src.connect(f).connect(g).connect(AC.destination); src.start(t); src.stop(t+o.dur);
  }catch(e){}
}
let chipCombo=0, chipComboT=0;
export function sfxTick(dt){ chipComboT-=dt; }
export const SFX = {
  // cute robot: a quick two-note "bwee-oop" chirp, randomly varied so it never sounds canned
  jump: ()=>{ const b=620+Math.random()*120; tone({type:'triangle',f:b,bend:[[.5,b*1.9],[1,b*1.6]],dur:.14,vol:.09,vib:12}); tone({type:'sine',f:b*2.2,to:b*3,dur:.1,at:.1,vol:.05}); },
  land: ()=>{ tone({type:'square',f:140,to:70,dur:.07,vol:.045,lp:600}); tone({type:'triangle',f:900,to:500,dur:.05,at:.03,vol:.025}); },
  stomp:()=>{ tone({type:'triangle',f:220,bend:[[.3,160],[1,520]],dur:.22,vol:.1}); tone({type:'sine',f:1300,to:1900,dur:.12,at:.08,vol:.05}); },
  // energy ball: rising charge whine + air intake, then a punchy "pew" with a sub thump
  charge:()=>{ tone({type:'sine',f:240,to:1400,dur:.27,vol:.06,vib:20,vibHz:40}); hiss({f:600,to:4000,dur:.27,vol:.06,q:2}); },
  shoot:()=>{ tone({type:'square',f:1100,to:180,dur:.2,vol:.1,lp:3500}); tone({type:'sawtooth',f:520,to:90,dur:.18,vol:.06,lp:1200}); tone({type:'sine',f:160,to:50,dur:.14,vol:.12}); hiss({f:3000,to:800,dur:.12,vol:.05}); },
  // bad guy destroyed: metallic crunch, low boom, noise bloom, then debris crackle
  hitE: ()=>{ tone({type:'sawtooth',f:480,to:70,dur:.28,vol:.12,lp:1800}); tone({type:'sine',f:120,to:35,dur:.45,vol:.16}); hiss({f:1800,to:150,dur:.45,vol:.16,q:.5});
              tone({type:'square',f:1200,to:140,dur:.2,vol:.05}); for(let i=0;i<5;i++) hiss({f:2500+Math.random()*2500,dur:.03,at:.12+i*.06+Math.random()*.03,vol:.05,q:3}); },
  // coins: bright two-note ding; pitch climbs when you grab several quickly
  chip: ()=>{ chipCombo=chipComboT>0?Math.min(7,chipCombo+1):0; chipComboT=.6; const r=Math.pow(2,chipCombo/12), f=1318*r;
              tone({type:'sine',f,dur:.09,vol:.08}); tone({type:'sine',f:f*1.5,dur:.26,at:.07,vol:.09}); tone({type:'triangle',f:f*3,dur:.12,at:.07,vol:.02}); },
  hurt: ()=>{ tone({type:'sawtooth',f:220,to:40,dur:.4,vol:.13,lp:900}); tone({type:'square',f:700,bend:[[.3,500],[.6,650],[1,300]],dur:.3,vol:.05}); hiss({f:400,dur:.25,vol:.08,type:'lowpass'}); },
  jet:  ()=>{ tone({type:'sawtooth',f:200,to:900,dur:.35,vol:.1,lp:2500}); tone({type:'sine',f:600,to:1400,dur:.4,vol:.08}); tone({type:'triangle',f:1800,to:2600,dur:.25,at:.2,vol:.05}); },
  ignite:()=>{ tone({type:'sawtooth',f:90,to:260,dur:.18,vol:.09,lp:900}); hiss({f:300,to:1800,dur:.2,vol:.1}); },
  laserCharge:()=>{ tone({type:'sine',f:500,to:2400,dur:.36,vol:.05,vib:15,vibHz:30}); },
  laser:()=>{ tone({type:'sawtooth',f:1500,to:300,dur:.18,vol:.07,lp:3000}); hiss({f:4000,to:1000,dur:.1,vol:.04}); },
  // bad guys approaching: hover drones ping like sonar, skimmers growl
  droneNear:()=>{ tone({type:'sine',f:1760,to:1700,dur:.12,vol:.06}); tone({type:'sine',f:1320,to:1280,dur:.16,at:.14,vol:.05}); },
  skimmerNear:()=>{ tone({type:'sawtooth',f:95,bend:[[.5,140],[1,80]],dur:.4,vol:.08,lp:500,vib:8,vibHz:25}); tone({type:'square',f:190,to:120,dur:.3,at:.05,vol:.03,lp:700}); },
};


// new for levels: checkpoint, repair kit, level clear jingle, gate warp
Object.assign(SFX, {
  checkpoint:()=>{ [523,659,784,1047].forEach((f,i)=>tone({type:'triangle',f,dur:.16,at:i*.06,vol:.06})); tone({type:'sine',f:2093,dur:.3,at:.24,vol:.03,vib:10}); },
  repair:()=>{ tone({type:'sine',f:440,to:880,dur:.18,vol:.08}); tone({type:'triangle',f:880,to:1320,dur:.22,at:.12,vol:.06,vib:8}); },
  warp:()=>{ tone({type:'sawtooth',f:120,to:1800,dur:.7,vol:.08,lp:2400}); hiss({f:400,to:6000,dur:.7,vol:.08,q:1.5}); tone({type:'sine',f:2400,to:3200,dur:.3,at:.5,vol:.04}); },
  clear:()=>{ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone({type:i<4?'triangle':'square',f,dur:i===6?.6:.14,at:i*.11,vol:.06,lp:i<4?0:3000})); },
  tick:()=>{ tone({type:'square',f:1600,dur:.03,vol:.025,lp:4000}); },
  select:()=>{ tone({type:'triangle',f:700,to:900,dur:.06,vol:.05}); },
  confirm:()=>{ tone({type:'triangle',f:660,dur:.08,vol:.07}); tone({type:'triangle',f:990,dur:.14,at:.07,vol:.07}); },
});
