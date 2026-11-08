/* =====================================================================
   TESTE — sincronização com música (experimental)
   Módulo separado do editor. Para remover: apague esta pasta, o bloco
   "@@MUSIC_UI@@" do HTML e a linha "@@MUSIC_JS@@" do script (ver build.py).
   Usa só os ganchos MUS_HOOK definidos no editor; sem este módulo eles ficam neutros.
   ===================================================================== */
(()=>{
const HZ=60, NB=8, MT={feat:null,url:null,sync:false};
const audio=new Audio(); audio.preload='auto';
const fmtT=s=>{ s=Math.max(0,s||0); return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'); };
const ui={add:$('musAdd'),file:$('musFile'),sync:$('musSync'),play:$('musPlay'),seek:$('musSeek'),time:$('musTime'),info:$('musInfo'),amp:$('musAmp'),remove:$('musRemove')};

/* FFT radix-2 (in place) */
function fft(re,im){
  const n=re.length;
  for(let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){ [re[i],re[j]]=[re[j],re[i]]; [im[i],im[j]]=[im[j],im[i]]; } }
  for(let len=2;len<=n;len<<=1){
    const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang), half=len>>1;
    for(let i=0;i<n;i+=len){
      let cr=1, ci=0;
      for(let j=0;j<half;j++){
        const a=i+j, b=a+half;
        const xr=re[b]*cr-im[b]*ci, xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr; im[b]=im[a]-xi; re[a]+=xr; im[a]+=xi;
        const nr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nr;
      }
    }
  }
}
// pré-análise: para cada quadro (60/s), energia em 8 faixas de frequência e pulso de batida (fluxo espectral)
function analyze(buf){
  const sr=buf.sampleRate, len=buf.length, nch=buf.numberOfChannels;
  const mono=new Float32Array(len);
  for(let c=0;c<nch;c++){ const d=buf.getChannelData(c); for(let i=0;i<len;i++) mono[i]+=d[i]/nch; }
  const N=1024, hop=Math.max(1,Math.round(sr/HZ)), F=Math.max(1,Math.floor((len-N)/hop)+1);
  const edges=[40,90,180,360,720,1400,2800,5600,16000];
  const bins=N/2, binHz=sr/N, bandOf=new Int8Array(bins).fill(-1), cnt=new Float32Array(NB);
  for(let b=1;b<bins;b++){ const f=b*binHz; for(let k=0;k<NB;k++) if(f>=edges[k]&&f<edges[k+1]){ bandOf[b]=k; cnt[k]++; break; } }
  const win=new Float64Array(N); for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));
  const raw=new Float32Array(F*NB), re=new Float64Array(N), im=new Float64Array(N);
  for(let f=0;f<F;f++){
    const o=f*hop;
    for(let i=0;i<N;i++){ re[i]=(mono[o+i]||0)*win[i]; im[i]=0; }
    fft(re,im);
    const acc=new Float64Array(NB);
    for(let b=1;b<bins;b++){ const k=bandOf[b]; if(k>=0) acc[k]+=Math.hypot(re[b],im[b]); }
    for(let k=0;k<NB;k++) raw[f*NB+k]=cnt[k]?acc[k]/cnt[k]:0;
  }
  // normaliza cada faixa pelo 95º percentil (a música toda define o "alto")
  const lv=new Float32Array(F*NB);
  for(let k=0;k<NB;k++){
    const arr=new Float32Array(F); for(let f=0;f<F;f++) arr[f]=raw[f*NB+k];
    arr.sort(); const ref=arr[Math.floor(F*0.95)]||1e-9;
    let prev=0;
    for(let f=0;f<F;f++){
      const v=Math.min(1.5,raw[f*NB+k]/ref);
      prev = v>prev ? v : prev*0.82+v*0.18; // ataque rápido, queda suave
      lv[f*NB+k]=prev;
    }
  }
  // fluxo espectral: quanto a energia subiu de um quadro para o outro (a "batida")
  const flux=new Float32Array(F);
  for(let f=1;f<F;f++){ let s=0; for(let k=0;k<NB;k++) s+=Math.max(0,lv[f*NB+k]-lv[(f-1)*NB+k]); flux[f]=s; }
  const fs=Float32Array.from(flux).sort(), fref=fs[Math.floor(F*0.95)]||1e-9;
  const pulse=new Float32Array(F); let pk=0;
  for(let f=0;f<F;f++){ const v=Math.min(1,flux[f]/fref); pk=Math.max(v,pk*0.86); pulse[f]=pk; }
  return {F,lv,pulse,dur:len/sr};
}

/* ----- ganchos para o editor ----- */
MUS_HOOK.active=()=>!!(MT.feat&&MT.sync);
MUS_HOOK.playing=()=>!!(MT.feat&&MT.sync&&!audio.paused);
MUS_HOOK.time=()=>audio.currentTime;
// colunas do quadro: faixas graves à esquerda, agudas à direita, + pulso e variação de caracteres
MUS_HOOK.frame=cols=>{
  if(!MUS_HOOK.active()) return null;
  const F=MT.feat, f=Math.min(F.F-1,Math.max(0,Math.floor(st.mt*HZ)));
  const col=new Float32Array(cols);
  for(let x=0;x<cols;x++){
    const p=cols>1?x/(cols-1)*(NB-1):0, k0=Math.min(NB-2,Math.floor(p)), fr=p-k0;
    col[x]=F.lv[f*NB+k0]*(1-fr)+F.lv[f*NB+k0+1]*fr;
  }
  return {col, amp:+ui.amp.value, wave:$('musWave').checked, chars:$('musChars').checked,
          pulse:$('musPulse').checked?F.pulse[f]:0, high:(F.lv[f*NB+5]+F.lv[f*NB+6]+F.lv[f*NB+7])/3, tick:f};
};
// gravação de vídeo: o áudio da música entra no arquivo, começando na posição atual
MUS_HOOK.recStart=()=>{
  if(!MUS_HOOK.active()) return null;
  audio.currentTime=st.mt; audio.play().catch(()=>{});
  const s=audio.captureStream?audio.captureStream():(audio.mozCaptureStream?audio.mozCaptureStream():null);
  return s?(s.getAudioTracks()[0]||null):null;
};
MUS_HOOK.recStop=()=>{ audio.pause(); };

/* ----- interface ----- */
function playLabel(){ ui.play.textContent=audio.paused?'Tocar':'Pausar'; }
function syncLabel(){
  ui.sync.setAttribute('aria-pressed',String(MT.sync));
  ui.sync.textContent=MT.sync?'Sincronização: ligada':'Sincronização: desligada';
  ui.sync.style.color=MT.sync?'var(--accent)':'';
}
ui.add.addEventListener('click',()=>ui.file.click());
ui.file.addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  if(!/^audio\//.test(f.type)&&!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)){ setStatus('Esse arquivo não é um áudio.'); return; }
  setStatus('Analisando a música… isso leva alguns segundos.');
  await new Promise(r=>setTimeout(r,30));
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const buf=await ctx.decodeAudioData(await f.arrayBuffer());
    ctx.close();
    MT.feat=analyze(buf);
  }catch(err){ setStatus('Não consegui ler esse áudio. Tente MP3 ou WAV.'); return; }
  if(MT.url) URL.revokeObjectURL(MT.url);
  MT.url=URL.createObjectURL(f); audio.src=MT.url; audio.load();
  ui.seek.max=MT.feat.dur; ui.seek.value=0; ui.seek.disabled=false;
  ui.play.disabled=false; ui.sync.disabled=false; ui.remove.disabled=false;
  ui.info.textContent=f.name+' · '+fmtT(MT.feat.dur);
  st.mt=0; setStatus('Música pronta. Ative a sincronização para o ASCII reagir.'); draw();
});
ui.remove.addEventListener('click',()=>{
  audio.pause(); audio.removeAttribute('src'); audio.load();
  MT.feat=null; MT.sync=false; syncLabel(); playLabel();
  ui.seek.disabled=true; ui.play.disabled=true; ui.sync.disabled=true; ui.remove.disabled=true;
  ui.info.textContent='Nenhuma música carregada.'; ui.time.textContent='0:00';
  setStatus('Música removida.'); draw();
});
ui.sync.addEventListener('click',()=>{ MT.sync=!MT.sync; syncLabel(); draw(); });
ui.play.addEventListener('click',()=>{ if(audio.paused) audio.play().catch(()=>setStatus('O navegador bloqueou a reprodução.')); else audio.pause(); });
audio.addEventListener('play',()=>{ playLabel(); draw(); });
audio.addEventListener('pause',()=>{ playLabel(); draw(); });
audio.addEventListener('ended',()=>{ playLabel(); draw(); });
ui.seek.addEventListener('input',()=>{ const v=+ui.seek.value; audio.currentTime=v; st.mt=v; draw(); });
ui.amp.addEventListener('input',()=>{ $('o-musAmp').textContent=Math.round(ui.amp.value*100)+'%'; draw(); });
$('o-musAmp').textContent=Math.round(ui.amp.value*100)+'%';
setInterval(()=>{
  if(!MT.feat) return;
  const t=audio.paused?st.mt:audio.currentTime;
  if(document.activeElement!==ui.seek) ui.seek.value=t;
  ui.time.textContent=fmtT(t)+' / '+fmtT(MT.feat.dur);
},200);
})();
