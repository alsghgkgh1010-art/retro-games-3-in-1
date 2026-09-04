/* =========================================================
   chiptune.js — 게임별 배경음악 신시사이저
   - 외부 파일·CDN·mp3 없음. Web Audio API 로 그 자리에서 합성.
   - 오프라인/file:// 에서도 동작. 저작권 문제 없음.
   계약: const jb = new Jukebox(); jb.play('shooter'); jb.stop();
        jb.setMuted(true/false); jb.muted
   ========================================================= */

/* ---------- 음계 도구 ---------- */
const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentaMajor: [0, 2, 4, 7, 9],
  pentaMinor: [0, 3, 5, 7, 10],
};

// 음계 위의 몇 번째 음(degree)을 MIDI 번호로. degree 는 음수·범위 밖도 허용(옥타브 자동).
function degToMidi(root, scale, deg) {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const idx = ((deg % n) + n) % n;
  return root + scale[idx] + 12 * oct;
}
const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* =========================================================
   트랙 정의
   prog  : 4마디 코드 진행(음계 degree). 마디마다 멜로디·베이스를 통째로 이조.
   bass  : 16스텝(1마디) 베이스. 숫자=degree, null=쉼표
   lead  : 32스텝(2마디) 멜로디. 숫자=degree, null=쉼표
   kick/snare/hat : 16스텝 0/1
   ========================================================= */
const TRACKS = {
  /* 👾 우주 슈팅 — 빠르고 긴박한 마이너 드라이브 */
  shooter: {
    bpm: 152, root: 45, scale: SCALES.minor, wave: 'square', bassWave: 'sawtooth',
    prog: [0, 0, 5, 4],
    bass:  [0,null,0,0, 4,null,0,null, 0,null,0,0, 2,null,4,null],
    lead:  [7,null,9,7, 11,null,9,7, 6,null,7,null, 4,null,null,null,
            7,null,9,11, 12,null,11,9, 7,null,6,7, 4,null,null,null],
    kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hat:   [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1],
  },

  /* 🧱 벽돌깨기 — 통통 튀는 밝은 메이저 */
  breakout: {
    bpm: 138, root: 48, scale: SCALES.major, wave: 'square', bassWave: 'triangle',
    prog: [0, 3, 4, 0],
    bass:  [0,null,null,0, null,4,null,null, 0,null,null,0, 4,null,2,null],
    lead:  [4,null,2,4, 7,null,null,4, 5,null,4,2, 0,null,null,null,
            7,null,7,9, 11,null,9,7, 4,null,5,4, 2,null,null,null],
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
  },

  /* 🐍 지렁이 게임 — 느긋하게 굴러가는 그루브 */
  snake: {
    bpm: 118, root: 43, scale: SCALES.pentaMajor, wave: 'triangle', bassWave: 'triangle',
    prog: [0, 2, 4, 3],
    bass:  [0,null,0,null, 3,null,null,0, 0,null,0,null, 4,null,null,null],
    lead:  [2,null,4,null, 5,null,4,2, null,null,2,null, 0,null,null,null,
            4,null,5,null, 7,null,5,4, null,null,4,2, 0,null,null,null],
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hat:   [1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,1,0],
  },

  /* 🧱 분수 벽돌깨기 — 밝지만 산만하지 않게(수업용) */
  fraction: {
    bpm: 124, root: 48, scale: SCALES.pentaMajor, wave: 'triangle', bassWave: 'triangle',
    prog: [0, 4, 2, 3],
    bass:  [0,null,null,null, 4,null,null,null, 0,null,null,null, 2,null,null,null],
    lead:  [4,null,null,5, 7,null,null,null, 5,null,4,null, 2,null,null,null,
            7,null,null,5, 4,null,null,null, 2,null,4,null, 0,null,null,null],
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },

  /* 🔤 영단어 슈팅 — 또박또박 걸어가는 리듬 */
  word: {
    bpm: 130, root: 50, scale: SCALES.major, wave: 'square', bassWave: 'triangle',
    prog: [0, 5, 3, 4],
    bass:  [0,null,0,null, null,null,4,null, 0,null,0,null, 4,null,null,null],
    lead:  [0,null,2,4, null,4,null,null, 5,null,4,2, null,null,null,null,
            4,null,5,7, null,7,null,null, 4,null,2,null, 0,null,null,null],
    kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },

  /* 🐍 연산 지렁이 — 딱딱 떨어지는 경쾌한 셈 리듬 */
  math: {
    bpm: 126, root: 45, scale: SCALES.pentaMajor, wave: 'square', bassWave: 'triangle',
    prog: [0, 3, 4, 0],
    bass:  [0,null,null,0, 3,null,null,null, 0,null,null,0, 4,null,4,null],
    lead:  [0,null,2,null, 4,null,2,null, 5,null,4,null, 2,null,null,null,
            4,null,5,null, 7,null,5,null, 4,null,2,null, 0,null,null,null],
    kick:  [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,0],
  },
};

/* =========================================================
   Jukebox
   ========================================================= */
const STORE_KEY = 'arcade.music.muted';

class Jukebox {
  constructor(volume) {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.volume = (volume === undefined) ? 0.3 : volume;
    this.trackId = null;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(STORE_KEY) === '1';
    } catch (e) { /* 저장 차단 환경이면 그냥 소리 켬 */ }
  }

  /* ---------- 오디오 준비(반드시 사용자 조작 이후에 호출) ---------- */
  _ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;                       // 지원 안 하는 브라우저면 조용히 포기
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    // 드럼용 화이트노이즈 1초 버퍼
    const len = Math.floor(this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return true;
  }

  /* ---------- 재생 / 정지 ---------- */
  play(id) {
    const t = TRACKS[id];
    if (!t) return;
    if (!this._ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.stop();
    this.trackId = id;
    this.track = t;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.trackId = null;
    this.track = null;
  }

  setMuted(m) {
    this.muted = !!m;
    try { localStorage.setItem(STORE_KEY, this.muted ? '1' : '0'); } catch (e) {}
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.05);
    }
  }

  toggleMuted() { this.setMuted(!this.muted); return this.muted; }

  /* ---------- 스케줄러(0.15초 앞을 미리 예약) ---------- */
  _schedule() {
    const t = this.track;
    if (!t) return;
    const stepDur = 60 / t.bpm / 4;              // 16분음표 길이(초)
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this._playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % 64;          // 4마디 루프
      this.nextTime += stepDur;
    }
  }

  _playStep(step, when, dur) {
    const t = this.track;
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    const chord = t.prog[bar];

    // 베이스
    const b = t.bass[s16];
    if (b !== null && b !== undefined) {
      this._tone(midiToHz(degToMidi(t.root, t.scale, b + chord)), when, dur * 1.7, t.bassWave, 0.20);
    }
    // 멜로디
    const l = t.lead[step % t.lead.length];
    if (l !== null && l !== undefined) {
      this._tone(midiToHz(degToMidi(t.root + 24, t.scale, l + chord)), when, dur * 1.5, t.wave, 0.11);
    }
    // 드럼
    if (t.kick[s16])  this._kick(when);
    if (t.snare[s16]) this._noise(when, 0.13, 0.13, 1400);
    if (t.hat[s16])   this._noise(when, 0.03, 0.045, 7000);
  }

  /* ---------- 음색 ---------- */
  _tone(hz, when, dur, type, peak) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.008);        // 짧은 어택
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);   // 자연스러운 감쇠
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.02);
  }

  _kick(when) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + 0.2);
  }

  _noise(when, dur, peak, hz) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hz;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(when); src.stop(when + dur + 0.02);
  }
}

export { Jukebox, TRACKS };
