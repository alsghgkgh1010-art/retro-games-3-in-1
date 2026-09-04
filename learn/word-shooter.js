// 영단어 슈팅 — 초등 3~6학년 영어 기초 어휘 학습 게임
// 학습게임 공통 인터페이스 계약(learn/INTERFACE.md v2) 준수
// - default export 클래스 1개, constructor(canvas) / start() / stop()
// - 외부 라이브러리·CDN·이미지·소리 없음. 순수 Canvas 2D + 인라인 코드.

const W = 800;            // 논리 가로 해상도
const H = 600;            // 논리 세로 해상도
const BG = '#0b0b12';     // 배경색

const PLAY_TOP = 118;     // 단어가 내려오기 시작하는 영역 위쪽
const FLOOR_Y = 516;      // 이 선을 넘으면 바닥에 닿은 것으로 본다
const PLAYER_Y = 532;
const PLAYER_W = 52;
const PLAYER_H = 24;
const PLAYER_SPEED = 340; // px/초
const SHOT_COOLDOWN = 0.3;
const BULLET_SPEED = 640;

const KO_FONT = 'system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

// ── 출제 어휘 (주제별) ─────────────────────────────────────────
// 초등 영어 교육과정에서 자주 다루는 기본 낱말 80개.
// 뜻은 초등 수준에서 가장 흔하게 쓰는 한 가지만 적는다(다의어 회피).
const WORD_GROUPS = [
  {
    topic: '학교·문구',
    words: [
      ['school', '학교'],
      ['teacher', '선생님'],
      ['classroom', '교실'],
      ['pencil', '연필'],
      ['eraser', '지우개'],
      ['book', '책'],
      ['desk', '책상'],
    ],
  },
  {
    topic: '가족·사람',
    words: [
      ['family', '가족'],
      ['father', '아버지'],
      ['mother', '어머니'],
      ['brother', '남자 형제'],
      ['sister', '여자 형제'],
      ['grandfather', '할아버지'],
      ['friend', '친구'],
    ],
  },
  {
    topic: '동물',
    words: [
      ['dog', '개'],
      ['cat', '고양이'],
      ['rabbit', '토끼'],
      ['monkey', '원숭이'],
      ['elephant', '코끼리'],
      ['tiger', '호랑이'],
      ['bird', '새'],
    ],
  },
  {
    topic: '음식',
    words: [
      ['bread', '빵'],
      ['milk', '우유'],
      ['apple', '사과'],
      ['egg', '달걀'],
      ['rice', '밥'],
      ['meat', '고기'],
      ['breakfast', '아침 식사'],
    ],
  },
  {
    topic: '색깔',
    words: [
      ['red', '빨간색'],
      ['blue', '파란색'],
      ['yellow', '노란색'],
      ['green', '초록색'],
      ['black', '검은색'],
      ['white', '흰색'],
    ],
  },
  {
    topic: '숫자',
    words: [
      ['one', '하나'],
      ['two', '둘'],
      ['three', '셋'],
      ['seven', '일곱'],
      ['eight', '여덟'],
      ['ten', '열'],
    ],
  },
  {
    topic: '몸',
    words: [
      ['head', '머리'],
      ['hand', '손'],
      ['foot', '발'],
      ['eye', '눈'],
      ['nose', '코'],
      ['mouth', '입'],
      ['ear', '귀'],
      ['shoulder', '어깨'],
    ],
  },
  {
    topic: '자연·날씨',
    words: [
      ['rain', '비'],
      ['wind', '바람'],
      ['cloud', '구름'],
      ['sun', '태양'],
      ['moon', '달'],
      ['star', '별'],
      ['tree', '나무'],
      ['flower', '꽃'],
    ],
  },
  {
    topic: '집·사물',
    words: [
      ['house', '집'],
      ['door', '문'],
      ['window', '창문'],
      ['chair', '의자'],
      ['bed', '침대'],
      ['kitchen', '부엌'],
      ['spoon', '숟가락'],
      ['clock', '시계'],
    ],
  },
  {
    topic: '동작',
    words: [
      ['run', '달리다'],
      ['jump', '뛰어오르다'],
      ['eat', '먹다'],
      ['drink', '마시다'],
      ['read', '읽다'],
      ['write', '쓰다'],
      ['sing', '노래하다'],
      ['sleep', '자다'],
    ],
  },
  {
    topic: '상태',
    words: [
      ['happy', '행복한'],
      ['sad', '슬픈'],
      ['hungry', '배고픈'],
      ['tired', '피곤한'],
      ['big', '큰'],
      ['small', '작은'],
      ['cold', '추운'],
      ['cloudy', '흐린'],
    ],
  },
];

// 전체 낱말 개수 (교사용 안내에 사용)
const TOTAL_WORDS = WORD_GROUPS.reduce((n, g) => n + g.words.length, 0);

// 교사용 정보 (셸의 "교사용 보기"에서 펼쳐 보여준다)
export const INFO = {
  subject: '영어',
  grade: '4~6학년',
  goal: '한글 뜻을 보고 알맞은 영어 낱말을 골라 기초 어휘를 익힌다.',
  minutes: 7,
  howto: '← → 로 움직이고 스페이스바로 쏘아 뜻에 맞는 영어 낱말을 맞히세요.',
  items: [
    'school — 학교',
    'teacher — 선생님',
    'pencil — 연필',
    'family — 가족',
    'brother — 남자 형제',
    'rabbit — 토끼',
    'elephant — 코끼리',
    'breakfast — 아침 식사',
    'bread — 빵',
    'yellow — 노란색',
    'seven — 일곱',
    'shoulder — 어깨',
    'mouth — 입',
    'cloud — 구름',
    'flower — 꽃',
    'kitchen — 부엌',
    'spoon — 숟가락',
    'jump — 뛰어오르다',
    'hungry — 배고픈',
    'cloudy — 흐린',
    '※ 위 20개는 예시이며, 전체 출제 낱말은 ' + TOTAL_WORDS + '개입니다.',
    '※ 주제: 학교·문구 / 가족·사람 / 동물 / 음식 / 색깔 / 숫자 / 몸 / 자연·날씨 / 집·사물 / 동작 / 상태',
  ],
};

/** 값을 min~max 사이로 자르기 */
function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

/** 두 사각형이 겹치는지 */
function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 0 이상 n 미만 정수 */
function randInt(n) {
  return Math.floor(Math.random() * n);
}

export default class WordShooter {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 루프/리스너 상태 (생성자에서는 절대 시작하지 않는다)
    this._raf = null;
    this._running = false;
    this._lastTime = 0;

    // 리스너는 바인딩된 참조를 필드에 저장해 stop()에서 정확히 해제
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._tick = this._tick.bind(this);

    this.keys = new Set();

    // 옵셔널 훅
    this.onScore = null;
    this.onGameOver = null;
    this.onStats = null;

    this._reset();
  }

  // ── 공개 API ────────────────────────────────────────────────

  /** 루프 시작 + 키 리스너 등록. 중복 호출해도 안전. */
  start() {
    if (this._running) return;
    this._running = true;
    this._reset();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this._lastTime = 0;
    this._raf = requestAnimationFrame(this._tick);
  }

  /** 루프 중지 + 리스너 전부 해제. 중복 호출해도 안전. */
  stop() {
    this._running = false;
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.keys.clear();
  }

  // ── 상태 초기화 ─────────────────────────────────────────────

  /** 새 판 시작 */
  _reset() {
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this.lives = 3;
    this.round = 0;
    this.elapsed = 0;          // 판 시작 후 흐른 시간(초) — 난이도 상승에 사용
    this.paused = false;
    this.gameOver = false;
    this._overNotified = false;

    this.player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
    this.bullets = [];
    this.shotTimer = 0;
    this.tiles = [];
    this.lastAnswer = '';      // 같은 문제가 연속으로 나오지 않게

    this.phase = 'play';       // 'play' | 'reveal'
    this.revealTimer = 0;
    this.revealKind = '';      // 'correct' | 'wrong' | 'miss'
    this.revealPicked = null;  // 학생이 맞힌 낱말(오답일 때 표시)
    this.flash = 0;            // 정답 시 짧은 깜빡임

    this._makeStars();
    this._makeRound();
    this._emitScore();
    this._emitStats();
  }

  /** 배경 별 (장식용) */
  _makeStars() {
    this.stars = [];
    for (let i = 0; i < 44; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: PLAY_TOP + Math.random() * (FLOOR_Y - PLAY_TOP),
        r: Math.random() < 0.25 ? 2 : 1,
      });
    }
  }

  /**
   * 새 문제 만들기.
   * 1) 주제군을 하나 고른다 → 2) 그 안에서 정답 낱말을 뽑는다(직전 정답과 겹치지 않게)
   * 3) 오답 보기는 같은 주제군의 다른 낱말에서만 뽑는다(학습 효과)
   *    같은 주제군이라 뜻이 절대 겹치지 않으므로 헷갈릴 위험이 없다.
   */
  _makeRound() {
    this.round += 1;

    const group = WORD_GROUPS[randInt(WORD_GROUPS.length)];
    const pool = group.words.slice();

    // 정답 뽑기 (직전 문제와 같은 낱말이면 다시 뽑는다)
    let ai = randInt(pool.length);
    if (pool.length > 1 && pool[ai][0] === this.lastAnswer) {
      ai = (ai + 1 + randInt(pool.length - 1)) % pool.length;
    }
    const answer = pool[ai];
    this.lastAnswer = answer[0];

    // 오답 후보 = 같은 주제군에서 정답을 뺀 나머지
    const rest = pool.filter((w, i) => i !== ai);
    for (let i = rest.length - 1; i > 0; i--) {  // 섞기
      const j = randInt(i + 1);
      const t = rest[i];
      rest[i] = rest[j];
      rest[j] = t;
    }

    // 보기 개수: 처음 두 문제는 4개, 이후 5개 (앞부분을 쉽게)
    const count = Math.min(this.round <= 2 ? 4 : 5, rest.length + 1);
    const picks = [answer].concat(rest.slice(0, count - 1));

    // 보기 순서 섞기
    for (let i = picks.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = picks[i];
      picks[i] = picks[j];
      picks[j] = t;
    }

    this.question = { topic: group.topic, en: answer[0], ko: answer[1] };
    this.tiles = this._layoutTiles(picks, answer[0]);
    this.bullets.length = 0;
  }

  /** 보기 낱말을 가로 칸(레인)에 나눠 배치한다 */
  _layoutTiles(picks, answerEn) {
    const ctx = this.ctx;
    ctx.font = 'bold 26px ' + KO_FONT;

    const n = picks.length;
    const laneW = W / n;

    // 레인 순서를 섞어 정답 위치가 예측되지 않게
    const lanes = [];
    for (let i = 0; i < n; i++) lanes.push(i);
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = t;
    }

    // 낙하 속도: 시간이 지날수록 조금씩 빨라진다 (시작 30초는 아주 느리게)
    const speed = 26 + Math.min(26, this.elapsed * 0.5) + Math.min(10, this.round * 0.5);

    const tiles = [];
    for (let i = 0; i < n; i++) {
      const [en, ko] = picks[i];
      const tw = ctx.measureText(en).width;
      const w = clamp(tw + 34, 108, laneW - 14);
      const h = 52;
      const cx = lanes[i] * laneW + laneW / 2;
      tiles.push({
        en,
        ko,
        isAnswer: en === answerEn,
        w,
        h,
        x: clamp(cx - w / 2, 8, W - 8 - w),
        y: PLAY_TOP - 70 - i * 46 - randInt(40),  // 시작 높이를 어긋나게
        vy: speed * (0.9 + Math.random() * 0.2),
        alive: true,
        mark: '',                                  // 'O' 또는 'X'
      });
    }
    return tiles;
  }

  // ── 입력 ───────────────────────────────────────────────────

  _onKeyDown(e) {
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' ||
        c === 'ArrowDown' || c === 'Space') {
      e.preventDefault();
    }
    if (e.repeat) return;

    if (c === 'KeyP') {
      if (!this.gameOver) this.paused = !this.paused;
      return;
    }
    if (c === 'KeyR') {
      this._reset();
      return;
    }
    this.keys.add(c);
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  /** 창 포커스가 빠지면 눌린 키를 모두 놓은 것으로 처리 */
  _onBlur() {
    this.keys.clear();
  }

  _left() { return this.keys.has('ArrowLeft') || this.keys.has('KeyA'); }
  _right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD'); }
  _firing() { return this.keys.has('Space'); }

  // ── 메인 루프 ──────────────────────────────────────────────

  _tick(now) {
    if (!this._running) return;
    if (!this._lastTime) this._lastTime = now;
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05;  // 탭 전환 등으로 인한 큰 점프 방지

    if (!this.paused && !this.gameOver) this._update(dt);
    this._draw();

    this._raf = requestAnimationFrame(this._tick);
  }

  _update(dt) {
    this.elapsed += dt;
    if (this.shotTimer > 0) this.shotTimer -= dt;
    if (this.flash > 0) this.flash -= dt;

    this._updatePlayer(dt);

    if (this.phase === 'reveal') {
      // 정답 공개 중에는 낱말이 멈춰 있고, 시간이 지나면 다음 문제로
      this.revealTimer -= dt;
      this.bullets.length = 0;
      if (this.revealTimer <= 0) {
        if (this.lives <= 0) this._endGame();
        else {
          this.phase = 'play';
          this.revealPicked = null;
          this._makeRound();
        }
      }
      return;
    }

    this._updateTiles(dt);
    this._updateBullets(dt);
  }

  _updatePlayer(dt) {
    let vx = 0;
    if (this._left()) vx -= 1;
    if (this._right()) vx += 1;
    this.player.x = clamp(
      this.player.x + vx * PLAYER_SPEED * dt,
      12,
      W - 12 - this.player.w
    );

    if (this.phase !== 'play') return;
    if (this._firing() && this.shotTimer <= 0 && this.bullets.length < 3) {
      this.bullets.push({
        x: this.player.x + this.player.w / 2 - 3,
        y: this.player.y - 14,
        w: 6,
        h: 16,
      });
      this.shotTimer = SHOT_COOLDOWN;
    }
  }

  _updateTiles(dt) {
    for (const t of this.tiles) {
      if (!t.alive) continue;
      t.y += t.vy * dt;
      if (t.y + t.h < FLOOR_Y) continue;

      if (t.isAnswer) {
        // 정답 낱말을 놓쳤다 → 목숨 하나 잃고 정답 공개
        this.lives -= 1;
        this._emitStats();
        this._beginReveal('miss');
        return;
      }
      t.alive = false;  // 오답은 그냥 지나간다
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= BULLET_SPEED * dt;
      if (b.y + b.h < PLAY_TOP - 90) { this.bullets.splice(i, 1); continue; }

      let struck = null;
      for (const t of this.tiles) {
        if (t.alive && hit(b, t)) { struck = t; break; }
      }
      if (!struck) continue;

      this.bullets.splice(i, 1);
      if (struck.isAnswer) {
        struck.mark = 'O';
        this.score += 100;
        this.correct += 1;
        this.flash = 0.45;
        this._emitScore();
        this._emitStats();
        this._beginReveal('correct');
      } else {
        struck.mark = 'X';
        struck.alive = false;
        this.score = Math.max(0, this.score - 20);
        this.wrong += 1;
        this.revealPicked = struck;
        this._emitScore();
        this._emitStats();
        this._beginReveal('wrong');
      }
      return;
    }
  }

  /** 정답 공개 화면으로 전환 (오답이어도 게임오버 없음) */
  _beginReveal(kind) {
    this.phase = 'reveal';
    this.revealKind = kind;
    this.revealTimer = kind === 'correct' ? 1.2 : 1.9;
    this.bullets.length = 0;
    // 정답 낱말에 O 표시를 달아 무엇이 맞았는지 보여준다
    for (const t of this.tiles) {
      if (t.isAnswer) { t.alive = true; t.mark = 'O'; }
    }
  }

  _endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    if (!this._overNotified) {
      this._overNotified = true;
      if (typeof this.onGameOver === 'function') this.onGameOver(this.score);
    }
  }

  _emitScore() {
    if (typeof this.onScore === 'function') this.onScore(this.score);
  }

  _emitStats() {
    if (typeof this.onStats === 'function') {
      this.onStats({ correct: this.correct, wrong: this.wrong });
    }
  }

  // ── 그리기 ─────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    this._drawStars(ctx);
    this._drawHud(ctx);
    this._drawQuestion(ctx);

    for (const t of this.tiles) {
      if (t.alive) this._drawTile(ctx, t);
    }

    // 바닥선
    ctx.fillStyle = '#39406b';
    ctx.fillRect(0, FLOOR_Y, W, 3);

    ctx.fillStyle = '#ffffff';
    for (const b of this.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    this._drawPlayer(ctx);
    this._drawHint(ctx);

    if (this.phase === 'reveal' && !this.gameOver) this._drawReveal(ctx);
    if (this.gameOver) this._drawGameOver(ctx);
    else if (this.paused) this._drawPaused(ctx);
  }

  _drawStars(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const s of this.stars) ctx.fillRect(s.x, s.y, s.r, s.r);
  }

  _drawHud(ctx) {
    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px ' + KO_FONT;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + String(this.score).padStart(4, '0'), 20, 14);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fe8ff';
    ctx.fillText('O ' + this.correct + '   X ' + this.wrong, W / 2, 14);

    // 목숨: 숫자와 하트 기호를 함께 (색만으로 구분하지 않기)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    let hearts = '';
    for (let i = 0; i < this.lives; i++) hearts += '♥';
    ctx.fillText('목숨 ' + this.lives + ' ' + hearts, W - 20, 14);

    ctx.textBaseline = 'alphabetic';
  }

  /** 화면 위쪽의 큰 문제 (한글 뜻) */
  _drawQuestion(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 문제 띠
    ctx.fillStyle = this.flash > 0 && Math.floor(this.flash * 12) % 2 === 0
      ? 'rgba(108,240,194,0.22)'
      : 'rgba(255,255,255,0.07)';
    ctx.fillRect(60, 46, W - 120, 58);
    ctx.strokeStyle = '#6a74c8';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 46, W - 120, 58);

    ctx.font = 'bold 20px ' + KO_FONT;
    ctx.fillStyle = '#b9c0ff';
    ctx.fillText('주제 ' + this.question.topic, W / 2, 118);

    ctx.font = 'bold 34px ' + KO_FONT;
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('문제:  ' + this.question.ko, W / 2, 76);

    ctx.textBaseline = 'alphabetic';
  }

  /** 내려오는 영어 낱말 한 칸 */
  _drawTile(ctx, t) {
    const isMarked = t.mark !== '';

    ctx.fillStyle = '#1b2140';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.lineWidth = isMarked ? 4 : 2;
    ctx.strokeStyle = t.mark === 'O' ? '#6cf0c2' : (t.mark === 'X' ? '#ff8a8a' : '#8f97d8');
    ctx.strokeRect(t.x, t.y, t.w, t.h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px ' + KO_FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.en, t.x + t.w / 2, t.y + t.h / 2 + 1);

    // O/X 기호를 칸 위에 함께 표시 (색만으로 구분하지 않기)
    if (isMarked) {
      ctx.font = 'bold 30px ' + KO_FONT;
      ctx.fillStyle = t.mark === 'O' ? '#6cf0c2' : '#ff8a8a';
      ctx.fillText(t.mark, t.x + t.w / 2, t.y - 18);
    }

    ctx.textBaseline = 'alphabetic';
  }

  _drawPlayer(ctx) {
    const p = this.player;
    ctx.fillStyle = '#6cf0c2';
    ctx.fillRect(p.x, p.y + p.h * 0.55, p.w, p.h * 0.45);
    ctx.fillRect(p.x + p.w * 0.2, p.y + p.h * 0.25, p.w * 0.6, p.h * 0.35);
    ctx.fillRect(p.x + p.w * 0.44, p.y, p.w * 0.12, p.h * 0.35);
  }

  _drawHint(ctx) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px ' + KO_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('← → 이동   스페이스 발사   P 일시정지   R 다시하기', W / 2, H - 14);
  }

  /** 정답/오답 알림 + 정답 낱말과 뜻 공개 */
  _drawReveal(ctx) {
    const q = this.question;
    ctx.fillStyle = 'rgba(5,5,12,0.72)';
    ctx.fillRect(0, 208, W, 172);
    ctx.strokeStyle = this.revealKind === 'correct' ? '#6cf0c2' : '#ff8a8a';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 208, W, 172);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 38px ' + KO_FONT;
    if (this.revealKind === 'correct') {
      ctx.fillStyle = '#6cf0c2';
      ctx.fillText('O  정답!', W / 2, 250);
    } else if (this.revealKind === 'wrong') {
      ctx.fillStyle = '#ff8a8a';
      const picked = this.revealPicked ? this.revealPicked.en : '';
      ctx.fillText('X  ' + picked + ' 은(는) 아니에요', W / 2, 250);
    } else {
      ctx.fillStyle = '#ff8a8a';
      ctx.fillText('X  놓쳤어요! 목숨 -1', W / 2, 250);
    }

    ctx.font = 'bold 40px ' + KO_FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(q.en + '  =  ' + q.ko, W / 2, 308);

    ctx.font = 'bold 22px ' + KO_FONT;
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('소리 내어 한 번 읽어 보세요', W / 2, 352);

    ctx.textBaseline = 'alphabetic';
  }

  _drawPaused(ctx) {
    ctx.fillStyle = 'rgba(5,5,12,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px ' + KO_FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('일시정지', W / 2, H / 2 - 10);
    ctx.font = 'bold 24px ' + KO_FONT;
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('P키를 다시 누르면 계속합니다', W / 2, H / 2 + 40);
  }

  _drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(5,5,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px ' + KO_FONT;
    ctx.fillStyle = '#ff7a7a';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 74);
    ctx.font = 'bold 32px ' + KO_FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + this.score, W / 2, H / 2 - 20);
    ctx.font = 'bold 28px ' + KO_FONT;
    ctx.fillStyle = '#9fe8ff';
    ctx.fillText('맞힌 낱말 ' + this.correct + '개   틀린 낱말 ' + this.wrong + '개', W / 2, H / 2 + 24);
    ctx.font = 'bold 26px ' + KO_FONT;
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('R키를 눌러 다시하기', W / 2, H / 2 + 74);
  }
}
