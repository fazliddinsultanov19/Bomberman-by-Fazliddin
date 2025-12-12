class AudioService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private currentLevel: number = 1;
  
  // Music State
  private isPlayingMusic: boolean = false;
  private nextNoteTime: number = 0;
  private noteIndex: number = 0;
  private schedulerTimer: number | null = null;
  private tempo: number = 120;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // s

  // --- Music Themes ---

  // Theme 1: Scout (Level 1-3) - Light, Upbeat
  private melody1 = [
    392.00, 0, 392.00, 440.00, 392.00, 0, 329.63, 0,
    392.00, 0, 392.00, 440.00, 392.00, 0, 329.63, 0,
    349.23, 0, 349.23, 392.00, 349.23, 0, 293.66, 0,
    349.23, 0, 349.23, 392.00, 349.23, 0, 293.66, 0
  ];
  private bass1 = [
    196.00, 0, 0, 0, 196.00, 0, 0, 0,
    196.00, 0, 0, 0, 196.00, 0, 0, 0,
    174.61, 0, 0, 0, 174.61, 0, 0, 0,
    174.61, 0, 0, 0, 174.61, 0, 0, 0
  ];

  // Theme 2: Infiltration (Level 4-7) - Faster, Minor, Driving
  private melody2 = [
    220.00, 0, 220.00, 0, 261.63, 0, 220.00, 0,
    196.00, 0, 196.00, 0, 220.00, 0, 196.00, 0,
    174.61, 0, 174.61, 0, 196.00, 0, 174.61, 0,
    164.81, 164.81, 164.81, 0, 146.83, 0, 0, 0
  ];
  private bass2 = [
    110.00, 110.00, 0, 110.00, 110.00, 110.00, 0, 110.00,
    98.00, 98.00, 0, 98.00, 98.00, 98.00, 0, 98.00,
    87.31, 87.31, 0, 87.31, 87.31, 87.31, 0, 87.31,
    82.41, 0, 0, 0, 82.41, 0, 0, 0
  ];

  // Theme 3: Cyber Boss (Level 8+) - Slow, Heavy, Dark
  private melody3 = [
    130.81, 0, 0, 0, 196.00, 0, 0, 0,
    185.00, 0, 0, 0, 174.61, 0, 0, 0,
    130.81, 0, 0, 0, 196.00, 0, 0, 0,
    261.63, 0, 246.94, 0, 233.08, 0, 220.00, 0
  ];
  private bass3 = [
    65.41, 0, 65.41, 0, 65.41, 0, 65.41, 0,
    65.41, 0, 65.41, 0, 65.41, 0, 65.41, 0,
    58.27, 0, 58.27, 0, 58.27, 0, 58.27, 0,
    58.27, 0, 58.27, 0, 58.27, 0, 58.27, 0
  ];

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    } catch (e) {
      console.warn("WebAudio not supported");
      this.enabled = false;
    }
  }

  public init() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setLevel(level: number) {
      this.currentLevel = level;
      // Adjust tempo based on theme
      if (level <= 3) this.tempo = 120;
      else if (level <= 7) this.tempo = 140;
      else this.tempo = 100; // Slow and heavy for final levels
  }

  public toggle(mute: boolean) {
    this.enabled = !mute;
    if (!this.enabled) {
        this.stopMusic();
    } else if (this.ctx) {
         if(!this.isPlayingMusic) this.startMusic();
    }
  }

  // --- Sound Effects ---

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number, time?: number) {
    if (!this.ctx || !this.enabled) return;
    
    const startTime = time || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  public playBombPlace() {
    this.playTone(300, 'sine', 0.1, 0.3);
  }

  public playExplosion() {
    if (!this.ctx || !this.enabled) return;
    const duration = 0.5;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, this.ctx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  public playPowerUp() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 1046.50].forEach((freq, i) => { 
        this.playTone(freq, 'square', 0.15, 0.15, now + i * 0.08);
    });
  }

  public playBossHit() {
    if (!this.ctx || !this.enabled) return;
    this.playTone(80, 'sawtooth', 0.2, 0.4);
  }

  public playDeath() {
    this.playTone(150, 'sawtooth', 0.6, 0.5);
    setTimeout(() => this.playTone(100, 'sawtooth', 0.6, 0.5), 200);
  }

  public playLevelClear() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      this.playTone(freq, 'triangle', 0.2, 0.2, now + i * 0.1);
    });
  }

  public playVictory() {
    if (!this.ctx || !this.enabled) return;
    this.stopMusic(); 
    const now = this.ctx.currentTime;
    const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50]; 
    const timing = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.2];
    notes.forEach((freq, i) => {
      this.playTone(freq, 'square', 0.3, 0.2, now + timing[i]);
    });
  }

  // --- Background Music Scheduler ---

  public startMusic() {
      if (this.isPlayingMusic || !this.ctx || !this.enabled) return;
      
      this.isPlayingMusic = true;
      this.noteIndex = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.scheduler();
  }

  public stopMusic() {
      this.isPlayingMusic = false;
      if (this.schedulerTimer) {
          window.clearTimeout(this.schedulerTimer);
          this.schedulerTimer = null;
      }
  }

  private nextNote() {
      const secondsPerBeat = 60.0 / this.tempo;
      this.nextNoteTime += 0.25 * secondsPerBeat; 
      this.noteIndex++;
  }

  private scheduleNote(beatNumber: number, time: number) {
      if (!this.ctx) return;

      let currentMelody = this.melody1;
      let currentBass = this.bass1;
      let wave: OscillatorType = 'triangle';

      if (this.currentLevel >= 4 && this.currentLevel <= 7) {
          currentMelody = this.melody2;
          currentBass = this.bass2;
          wave = 'square';
      } else if (this.currentLevel >= 8) {
          currentMelody = this.melody3;
          currentBass = this.bass3;
          wave = 'sawtooth';
      }

      const melodyFreq = currentMelody[beatNumber % currentMelody.length];
      if (melodyFreq > 0) {
          this.playTone(melodyFreq, wave, 0.15, 0.2, time);
      }

      const bassFreq = currentBass[beatNumber % currentBass.length];
      if (bassFreq > 0) {
          this.playTone(bassFreq, 'sawtooth', 0.2, 0.15, time);
      }
  }

  private scheduler = () => {
      if (!this.isPlayingMusic || !this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
          this.scheduleNote(this.noteIndex, this.nextNoteTime);
          this.nextNote();
      }
      this.schedulerTimer = window.setTimeout(this.scheduler, this.lookahead);
  };
}

export const audioService = new AudioService();