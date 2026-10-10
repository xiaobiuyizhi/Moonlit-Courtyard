// A quiet, generated soundscape. No recordings or network requests; muted by default.
export function createSoundscape() {
  let context,master,noiseSource,timer;
  function initialize(){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('此浏览器暂不支持环境音');
    context=new AudioContext();master=context.createGain();master.gain.value=0;master.connect(context.destination);
    const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),channel=buffer.getChannelData(0);
    let last=0;for(let i=0;i<channel.length;i++){last=(last+Math.random()*.035-.0175)/1.025;channel[i]=last*2;}
    noiseSource=context.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;
    const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=460;
    const waterGain=context.createGain();waterGain.gain.value=.26;
    noiseSource.connect(lowpass).connect(waterGain).connect(master);noiseSource.start();
    timer=setInterval(()=>{
      if(context.state!=='running'||master.gain.value<.01)return;
      const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
      osc.frequency.value=3200+Math.random()*400;osc.type='sine';gain.gain.setValueAtTime(0,now);
      for(let i=0;i<3;i++){gain.gain.linearRampToValueAtTime(.007,now+i*.09+.012);gain.gain.linearRampToValueAtTime(0,now+i*.09+.05);}
      osc.connect(gain).connect(master);osc.start(now);osc.stop(now+.3);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    },2400);
  }
  return {
    async setEnabled(enabled){if(!context&&enabled)initialize();if(!context)return;if(enabled)await context.resume();master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(enabled?.7:0,context.currentTime,.25);},
    suspend(){context?.suspend();},
    async resume(){if(context&&master.gain.value>.01)await context.resume();},
    dispose(){clearInterval(timer);noiseSource?.stop();context?.close();}
  };
}
