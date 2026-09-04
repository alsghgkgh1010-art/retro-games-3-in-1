// 분수 벽돌깨기 — 초등 5~6학년 분수 학습용 벽돌깨기
// 학습게임 공통 인터페이스 계약 v2 준수: default export 클래스 1개 + INFO named export
// 외부 라이브러리·CDN·웹폰트·이미지·소리 없음. 순수 Canvas 2D, 파일 하나로 자급자족.

const W = 800;          // 논리 가로 해상도(고정)
const H = 600;          // 논리 세로 해상도(고정)
const BG = '#0b0b12';   // 배경색(계약값)

// 시스템 폰트 스택(웹폰트 금지)
const FONT = 'system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';

// ---- 화면 구역 ----
const HUD_H = 70;              // 상단 점수·목숨 띠
const Q_TOP = HUD_H;           // 문제 띠 시작
const Q_BOTTOM = 146;          // 문제 띠 끝
const WALL = 12;               // 벽 두께
const FIELD_TOP = Q_BOTTOM + WALL; // 놀이판 위쪽 경계(158)

// ---- 패들 ----
const PADDLE_W = 140;          // 초보 배려: 넉넉한 폭
const PADDLE_H = 16;
const PADDLE_Y = H - 46;
const PADDLE_SPEED = 640;      // px/초

// ---- 공 ----
const BALL_R = 9;
const SPEED_BASE = 205;        // 1스테이지 시작 속도(느긋하게)
const SPEED_STEP = 18;         // 스테이지당 상승폭
const SPEED_MAX = 380;         // 속도 상한
const MIN_VY_RATIO = 0.32;     // 수평 갇힘 방지
const MIN_VX_RATIO = 0.12;     // 수직 갇힘 방지

// ---- 벽돌 ----
const ROWS = 4;
const COLS = 6;
const BRICK_GAP = 8;
const BRICK_MARGIN_X = 24;
const BRICK_TOP = FIELD_TOP + 14;
const BRICK_H = 56;
const BRICK_W = (W - BRICK_MARGIN_X * 2 - BRICK_GAP * (COLS - 1)) / COLS;
// 줄마다 색이 다르지만, 정답/오답과는 아무 상관 없다(색으로 정답을 알 수 없게).
const ROW_FILL = ['#2f3a63', '#33406e', '#374679', '#3b4c85'];
const ROW_EDGE = ['#8fa4ff', '#98abff', '#a2b3ff', '#adbbff'];

const STAGE_GOAL = 5;          // 한 스테이지에서 맞혀야 하는 문제 수
const MIN_ALIVE = 8;           // 살아있는 벽돌이 이보다 적으면 다시 채운다

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ===== 분수 계산 도우미 (계산이 틀리면 안 되므로 정수 연산만 사용) =====

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

// 값 객체 만들기: 항상 기약분수로 줄인다.
// 결과 형태 → {t:'int', v} 또는 {t:'frac', n, d}
function mkFrac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  const nn = n / g, dd = d / g;
  if (dd === 1) return { t: 'int', v: nn };
  return { t: 'frac', n: nn, d: dd };
}

// 대분수 값 객체 (w는 자연수 부분, n/d는 기약 진분수)
function mkMixed(w, n, d) {
  if (n === 0) return { t: 'int', v: w };
  const g = gcd(n, d);
  return { t: 'mixed', w, n: n / g, d: d / g };
}

// 값의 크기(비교·중복 판정용)
function vnum(v) {
  if (v.t === 'int') return v.v;
  if (v.t === 'frac') return v.n / v.d;
  return v.w + v.n / v.d;
}

// 표기까지 구별하는 고유 키(3/4 와 6/8 은 다른 보기로 취급)
function vkey(v) {
  if (v.t === 'int') return 'i' + v.v;
  if (v.t === 'frac') return 'f' + v.n + '/' + v.d;
  return 'm' + v.w + '_' + v.n + '/' + v.d;
}

// 사람이 읽는 글자(교사용 INFO·피드백용)
function vtext(v) {
  if (v.t === 'int') return String(v.v);
  if (v.t === 'frac') return v.n + '/' + v.d;
  return v.w + ' ' + v.n + '/' + v.d;
}

// 줄이지 않은 그대로의 분수(오답 보기용). 자연수로 떨어지면 만들지 않는다.
function rawFrac(n, d) {
  if (d === 0) return null;
  if (n % d === 0) return { t: 'int', v: n / d };
  return { t: 'frac', n, d };
}

// ===== 문제 생성 =====
// 모든 문제는 아래 형태를 돌려준다.
// { tokens: 화면에 그릴 조각들, answer: 정답 값 객체, key, wrongSeeds: [오답 후보], meta: 검증용 원자료 }

// 1) 동분모 분수의 덧셈·뺄셈 (4학년 복습)
function makeSameDenom() {
  const d = randInt(3, 12);
  const plus = Math.random() < 0.5;
  let a, b;
  if (plus) {
    // 합이 1보다 작게 만들어 진분수 답이 나오게 한다
    a = randInt(1, d - 2);
    b = randInt(1, d - 1 - a);
  } else {
    a = randInt(2, d - 1);
    b = randInt(1, a - 1);
  }
  const sum = plus ? a + b : a - b;
  const answer = mkFrac(sum, d);
  const wrongSeeds = [];
  // 흔한 오개념: 분모끼리도 계산해 버리기
  wrongSeeds.push(rawFrac(sum, d + d));
  // 흔한 오개념: 덧셈과 뺄셈을 반대로 하기
  if (!plus) wrongSeeds.push(rawFrac(a + b, d));
  wrongSeeds.push(rawFrac(sum + 1, d));
  if (sum - 1 >= 1) wrongSeeds.push(rawFrac(sum - 1, d));
  return {
    tokens: [
      { t: 'frac', n: a, d },
      { t: 'text', s: plus ? '+' : '−' },
      { t: 'frac', n: b, d },
      { t: 'text', s: '= ?' },
    ],
    answer,
    key: vkey(answer),
    wrongSeeds,
    meta: { kind: 'same', a, b, d, plus },
  };
}

// 2) 이분모 분수의 덧셈·뺄셈 (5학년, 분모 12 이하)
function makeDiffDenom() {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const d1 = randInt(2, 10);
    let d2 = randInt(2, 12);
    if (d1 === d2) continue;
    const a = randInt(1, d1 - 1);
    const b = randInt(1, d2 - 1);
    const plus = Math.random() < 0.5;
    const num = plus ? a * d2 + b * d1 : a * d2 - b * d1;
    const den = d1 * d2;
    if (den > 120) continue;
    if (plus && num >= den) continue;   // 답은 진분수로
    if (!plus && num <= 0) continue;    // 답은 0보다 크게
    const answer = mkFrac(num, den);
    const wrongSeeds = [
      // 흔한 오개념: 분자는 분자끼리, 분모는 분모끼리
      rawFrac(plus ? a + b : Math.abs(a - b), d1 + d2),
      rawFrac(plus ? a + b : Math.abs(a - b), Math.max(d1, d2)),
      rawFrac(num, den), // 통분만 하고 약분을 안 한 값
      rawFrac(plus ? num + 1 : num + 1, den),
    ];
    return {
      tokens: [
        { t: 'frac', n: a, d: d1 },
        { t: 'text', s: plus ? '+' : '−' },
        { t: 'frac', n: b, d: d2 },
        { t: 'text', s: '= ?' },
      ],
      answer,
      key: vkey(answer),
      wrongSeeds,
      meta: { kind: 'diff', a, d1, b, d2, plus },
    };
  }
  return makeSameDenom();
}

// 3) 분수의 크기 비교
function makeCompare() {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const d1 = randInt(2, 12);
    const d2 = randInt(2, 12);
    const a = randInt(1, d1 - 1);
    const b = randInt(1, d2 - 1);
    if (gcd(a, d1) !== 1 || gcd(b, d2) !== 1) continue; // 보기는 기약분수로만
    const v1 = a * d2, v2 = b * d1;
    if (v1 === v2) continue;
    const f1 = { t: 'frac', n: a, d: d1 };
    const f2 = { t: 'frac', n: b, d: d2 };
    const bigger = Math.random() < 0.5;   // 더 큰 것 / 더 작은 것 번갈아 묻기
    let answer, other;
    if ((v1 > v2) === bigger) { answer = f1; other = f2; } else { answer = f2; other = f1; }
    return {
      tokens: [
        f1,
        { t: 'text', s: '과' },
        f2,
        { t: 'text', s: '중 더 ' + (bigger ? '큰' : '작은') + ' 것은?' },
      ],
      answer,
      key: vkey(answer),
      wrongSeeds: [other],
      meta: { kind: 'compare', a, d1, b, d2, bigger },
    };
  }
  return makeSameDenom();
}

// 4) 약분해서 기약분수로 나타내기
function makeReduce() {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const d0 = randInt(2, 7);
    const n0 = randInt(1, d0 - 1);
    if (gcd(n0, d0) !== 1) continue;
    const m = randInt(2, 4);
    const n = n0 * m, d = d0 * m;
    if (d > 28) continue;
    const answer = mkFrac(n, d); // = n0/d0
    const wrongSeeds = [];
    // 절반만 약분한 값, 분자만 나눈 값 같은 그럴듯한 오답
    if (m === 4) wrongSeeds.push(rawFrac(n0 * 2, d0 * 2));
    wrongSeeds.push(rawFrac(n0, d0 + 1));
    wrongSeeds.push(rawFrac(n0 + 1, d0));
    wrongSeeds.push(rawFrac(n - m, d));
    return {
      tokens: [
        { t: 'frac', n, d },
        { t: 'text', s: '을(를) 기약분수로?' },
      ],
      answer,
      key: vkey(answer),
      wrongSeeds,
      meta: { kind: 'reduce', n, d },
    };
  }
  return makeSameDenom();
}

// 5) 가분수 → 대분수
function makeToMixed() {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const d = randInt(2, 9);
    const w = randInt(1, 4);
    const r = randInt(1, d - 1);
    if (gcd(r, d) !== 1) continue;
    const n = w * d + r;
    const answer = mkMixed(w, r, d);
    const wrongSeeds = [
      { t: 'mixed', w: w + 1, n: r, d },
      w > 1 ? { t: 'mixed', w: w - 1, n: r, d } : { t: 'mixed', w: w + 2, n: r, d },
      { t: 'mixed', w: r, n: w, d },              // 자연수와 분자를 바꿔 쓴 오답
      { t: 'mixed', w, n: d - r, d },
    ];
    return {
      tokens: [
        { t: 'frac', n, d },
        { t: 'text', s: '을(를) 대분수로?' },
      ],
      answer,
      key: vkey(answer),
      wrongSeeds,
      meta: { kind: 'tomixed', n, d },
    };
  }
  return makeSameDenom();
}

// 6) 대분수 → 가분수
function makeToImproper() {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const d = randInt(2, 9);
    const w = randInt(1, 4);
    const r = randInt(1, d - 1);
    if (gcd(r, d) !== 1) continue;
    const n = w * d + r;              // gcd(n,d)=gcd(r,d)=1 이므로 이미 기약
    const answer = { t: 'frac', n, d };
    const wrongSeeds = [
      rawFrac(w + r, d),              // 흔한 오개념: 자연수와 분자를 그냥 더하기
      rawFrac(w * d, d),
      rawFrac(n + d, d),
      rawFrac(n - 1, d),
    ];
    return {
      tokens: [
        { t: 'mixed', w, n: r, d },
        { t: 'text', s: '을(를) 가분수로?' },
      ],
      answer,
      key: vkey(answer),
      wrongSeeds,
      meta: { kind: 'toimproper', w, r, d },
    };
  }
  return makeSameDenom();
}

// 스테이지에 따라 문제 유형을 넓힌다(처음 30초는 누구나 성공하도록 쉬운 유형만).
function makeProblem(stage) {
  let makers;
  if (stage <= 1) makers = [makeSameDenom, makeSameDenom, makeReduce];
  else if (stage === 2) makers = [makeSameDenom, makeReduce, makeCompare, makeToMixed];
  else makers = [makeSameDenom, makeDiffDenom, makeCompare, makeReduce, makeToMixed, makeToImproper];
  return pick(makers)();
}

// 정답 말고 화면을 채울 보기(오답)를 만든다.
function fillerValue(answer) {
  if (answer.t === 'mixed') {
    const d = randInt(2, 9);
    const n = randInt(1, d - 1);
    return { t: 'mixed', w: randInt(1, 5), n, d };
  }
  const d = randInt(2, 12);
  const n = randInt(1, d - 1);
  return { t: 'frac', n, d };
}

// 보기 목록 만들기: 정답 correctCount개 + 나머지는 오답. 섞어서 돌려준다.
// 약분 문제만 "값은 같지만 기약이 아닌" 보기를 허용한다(그게 바로 배울 점이라서).
function buildOptions(problem, total, correctCount) {
  const allowSameValue = problem.meta.kind === 'reduce';
  const ansNum = vnum(problem.answer);
  const used = new Set([problem.key]);
  const wrongs = [];

  const tryAdd = (v) => {
    if (!v) return;
    if (v.t === 'int' && v.v <= 0) return;
    if (v.t === 'frac' && (v.n <= 0 || v.d <= 1)) return;
    if (v.t === 'mixed' && (v.n <= 0 || v.d <= 1 || v.w <= 0)) return;
    const k = vkey(v);
    if (used.has(k)) return;
    if (!allowSameValue && Math.abs(vnum(v) - ansNum) < 1e-9) return;
    used.add(k);
    wrongs.push(v);
  };

  (problem.wrongSeeds || []).forEach(tryAdd);
  let guard = 0;
  while (wrongs.length < total - correctCount && guard < 2000) {
    tryAdd(fillerValue(problem.answer));
    guard++;
  }

  const options = [];
  for (let i = 0; i < correctCount; i++) options.push(problem.answer);
  for (let i = 0; i < total - correctCount; i++) {
    options.push(wrongs[i % Math.max(1, wrongs.length)] || fillerValue(problem.answer));
  }
  // 섞기(피셔-예이츠)
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = options[i]; options[i] = options[j]; options[j] = t;
  }
  return options;
}

// ===== 교사용 정보 =====
export const INFO = {
  subject: '수학',
  grade: '5~6학년',
  goal: '분수의 덧셈·뺄셈, 크기 비교, 약분, 대분수와 가분수 바꾸기를 익힌다.',
  minutes: 8,
  howto: '← → 로 막대를 움직이고 스페이스바로 공을 쏘아, 화면 위 문제의 정답이 적힌 벽돌을 맞히세요.',
  items: [
    '3/8 + 2/8 = 5/8',
    '5/6 − 1/6 = 2/3',
    '1/2 + 1/4 = 3/4',
    '2/3 + 1/6 = 5/6',
    '3/4 − 1/3 = 5/12',
    '7/10 − 1/5 = 1/2',
    '2/3 과 3/5 중 더 큰 것은? → 2/3',
    '5/8 과 1/2 중 더 작은 것은? → 1/2',
    '6/8 을 기약분수로 → 3/4',
    '9/12 를 기약분수로 → 3/4',
    '10/15 를 기약분수로 → 2/3',
    '7/3 을 대분수로 → 2 1/3',
    '11/4 를 대분수로 → 2 3/4',
    '1 2/3 을 가분수로 → 5/3',
    '3 1/2 을 가분수로 → 7/2',
    '2 3/5 을 가분수로 → 13/5',
  ],
};

// ===== 게임 본체 =====

export default class FractionBreakout {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 셸이 넣어 주는 훅(없어도 정상 동작)
    this.onScore = null;
    this.onGameOver = null;
    this.onStats = null;

    // 리스너·루프는 고정 참조로 보관(익명 함수 금지)
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._loop = this._loop.bind(this);

    this._rafId = 0;
    this._running = false;
    this._listening = false;
    this._lastTs = 0;
    this._needFresh = false;

    this.keys = { left: false, right: false };
    this._resetGame();
  }

  // ===== 생명주기 =====

  start() {
    if (this._running) return;              // 중복 호출 안전
    this._running = true;
    if (!this._listening) {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this._listening = true;
    }
    if (this.state === 'over' || this._needFresh) this._resetGame();
    this._needFresh = false;
    this._lastTs = 0;
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (!this._running && !this._listening) return;  // 중복 호출 안전
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0; }
    if (this._listening) {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      this._listening = false;
    }
    this.keys.left = false;
    this.keys.right = false;
    this._needFresh = true;   // 다음 start()는 새 판
  }

  // ===== 상태 =====

  _resetGame() {
    this.score = 0;
    this.lives = 3;
    this.stage = 1;
    this.correct = 0;
    this.wrong = 0;
    this.solved = 0;              // 이번 스테이지에서 맞힌 문제 수
    this.state = 'ready';         // ready | playing | paused | stageclear | over
    this.stageTimer = 0;
    this.flash = 0;               // 목숨을 잃었을 때 붉은 표시
    this.feedback = null;         // {ok, val, timer}
    this._needFresh = false;
    this.paddle = { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
    this._buildBricks();
    this._newProblem(true);
    this._resetBall();
    this._emitScore();
    this._emitStats();
  }

  _buildBricks() {
    this.bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.bricks.push({
          x: BRICK_MARGIN_X + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          row: r,
          alive: true,
          val: null,
          correct: false,
        });
      }
    }
  }

  // 새 문제를 내고, 살아있는 벽돌에 보기를 다시 적는다.
  _newProblem(first) {
    let next = makeProblem(this.stage);
    // 같은 문제가 연속으로 나오지 않게 한 번 더 뽑는다
    if (!first && this.problem) {
      for (let i = 0; i < 8 && next.key === this.problem.key && vtext(next.answer) === vtext(this.problem.answer); i++) {
        next = makeProblem(this.stage);
      }
    }
    this.problem = next;
    this._labelBricks();
  }

  _labelBricks() {
    let alive = this.bricks.filter((b) => b.alive);
    if (alive.length < MIN_ALIVE) {            // 벽돌이 너무 줄면 다시 채운다
      this.bricks.forEach((b) => { b.alive = true; });
      alive = this.bricks.slice();
    }
    // 정답 벽돌은 1~2개. 시작 스테이지는 넉넉하게 2개.
    let correctCount = this.stage <= 1 ? 2 : (Math.random() < 0.5 ? 1 : 2);
    correctCount = clamp(correctCount, 1, alive.length);
    const options = buildOptions(this.problem, alive.length, correctCount);
    for (let i = 0; i < alive.length; i++) {
      alive[i].val = options[i];
      alive[i].correct = vkey(options[i]) === this.problem.key;
    }
  }

  _resetBall() {
    this.speed = Math.min(SPEED_BASE + (this.stage - 1) * SPEED_STEP, SPEED_MAX);
    this.ball = {
      x: this.paddle.x + this.paddle.w / 2,
      y: this.paddle.y - BALL_R - 1,
      vx: 0, vy: 0, stuck: true,
    };
  }

  _launch() {
    if (!this.ball.stuck) return;
    const angle = (-Math.PI / 2) + (Math.random() * 0.5 - 0.25); // 위쪽으로 살짝 비스듬히
    this.ball.vx = Math.cos(angle) * this.speed;
    this.ball.vy = Math.sin(angle) * this.speed;
    this.ball.stuck = false;
    this.state = 'playing';
    this._enforceAngle();
  }

  _emitScore() { if (typeof this.onScore === 'function') this.onScore(this.score); }
  _emitStats() { if (typeof this.onStats === 'function') this.onStats({ correct: this.correct, wrong: this.wrong }); }

  _addScore(n) {
    this.score = Math.max(0, this.score + n);
    this._emitScore();
  }

  // ===== 입력 =====

  _onKeyDown(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === ' ' || k === 'Spacebar') {
      e.preventDefault(); // 화살표·스페이스로 화면이 스크롤되지 않게
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.keys.left = true;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') this.keys.right = true;

    if (k === ' ' || k === 'Spacebar') {
      if (this.state === 'ready' || this.state === 'playing') this._launch();
    }
    if (k === 'p' || k === 'P') {
      if (this.state === 'playing' || this.state === 'ready') this.state = 'paused';
      else if (this.state === 'paused') this.state = this.ball.stuck ? 'ready' : 'playing';
    }
    if (k === 'r' || k === 'R') this._resetGame();
    // ESC는 셸 전용이라 쓰지 않는다.
  }

  _onKeyUp(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') this.keys.right = false;
  }

  // ===== 루프 =====

  _loop(ts) {
    if (!this._running) return;
    if (!this._lastTs) this._lastTs = ts;
    const dt = clamp((ts - this._lastTs) / 1000, 0, 0.05); // 탭 전환 시 dt 폭주 방지
    this._lastTs = ts;
    this._update(dt);
    this._draw();
    this._rafId = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.feedback) {
      this.feedback.timer -= dt;
      if (this.feedback.timer <= 0) this.feedback = null;
    }
    if (this.state === 'paused' || this.state === 'over') return;

    this._movePaddle(dt);

    if (this.state === 'stageclear') {
      this.stageTimer -= dt;
      if (this.stageTimer <= 0) {
        this.stage += 1;
        this.solved = 0;
        this.bricks.forEach((b) => { b.alive = true; });
        this._newProblem(false);
        this._resetBall();
        this.state = 'ready';
      }
      return;
    }

    if (this.ball.stuck) {   // 발사 전에는 막대를 따라다닌다
      this.ball.x = this.paddle.x + this.paddle.w / 2;
      this.ball.y = this.paddle.y - BALL_R - 1;
      return;
    }
    this._moveBall(dt);
  }

  _movePaddle(dt) {
    const p = this.paddle;
    if (this.keys.left) p.x -= PADDLE_SPEED * dt;
    if (this.keys.right) p.x += PADDLE_SPEED * dt;
    p.x = clamp(p.x, WALL, W - WALL - p.w);
  }

  // 빠른 공이 벽돌을 통과하지 않도록 잘게 나눠 이동
  _moveBall(dt) {
    const b = this.ball;
    const dist = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      this._collideWalls();
      if (this.state !== 'playing') return;
      this._collideBricks();
      this._collidePaddle();
      if (this.state !== 'playing') return;
    }
  }

  _collideWalls() {
    const b = this.ball;
    if (b.x - BALL_R < WALL) { b.x = WALL + BALL_R; b.vx = Math.abs(b.vx); this._enforceAngle(); }
    if (b.x + BALL_R > W - WALL) { b.x = W - WALL - BALL_R; b.vx = -Math.abs(b.vx); this._enforceAngle(); }
    if (b.y - BALL_R < FIELD_TOP) { b.y = FIELD_TOP + BALL_R; b.vy = Math.abs(b.vy); this._enforceAngle(); }
    if (b.y - BALL_R > H) this._loseLife();   // 바닥으로 놓쳤을 때만 목숨이 준다
  }

  _collidePaddle() {
    const b = this.ball;
    const p = this.paddle;
    if (b.vy <= 0) return;
    if (b.y + BALL_R < p.y || b.y - BALL_R > p.y + p.h) return;
    if (b.x + BALL_R < p.x || b.x - BALL_R > p.x + p.w) return;
    const hit = clamp((b.x - (p.x + p.w / 2)) / (p.w / 2), -1, 1);
    const maxAngle = (62 * Math.PI) / 180;
    const angle = hit * maxAngle;
    const sp = Math.min(Math.hypot(b.vx, b.vy), SPEED_MAX);
    b.vx = Math.sin(angle) * sp;
    b.vy = -Math.cos(angle) * sp;
    b.y = p.y - BALL_R - 0.5;
    this._enforceAngle();
  }

  _collideBricks() {
    const b = this.ball;
    for (let i = 0; i < this.bricks.length; i++) {
      const k = this.bricks[i];
      if (!k.alive) continue;
      if (b.x + BALL_R < k.x || b.x - BALL_R > k.x + k.w) continue;
      if (b.y + BALL_R < k.y || b.y - BALL_R > k.y + k.h) continue;

      // 겹침이 작은 축으로 되튄다
      const overlapX = Math.min(b.x + BALL_R - k.x, k.x + k.w - (b.x - BALL_R));
      const overlapY = Math.min(b.y + BALL_R - k.y, k.y + k.h - (b.y - BALL_R));
      if (overlapX < overlapY) { b.vx = -b.vx; b.x += b.vx > 0 ? overlapX : -overlapX; }
      else { b.vy = -b.vy; b.y += b.vy > 0 ? overlapY : -overlapY; }
      this._enforceAngle();

      k.alive = false;
      if (k.correct) this._onCorrect();
      else this._onWrong();
      return; // 한 번에 벽돌 하나만 처리
    }
  }

  _onCorrect() {
    this.correct += 1;
    this.solved += 1;
    this._addScore(100);
    this._emitStats();
    this.feedback = { ok: true, val: this.problem.answer, timer: 1.2 };
    if (this.solved >= STAGE_GOAL) {
      this.state = 'stageclear';
      this.stageTimer = 1.8;
      return;
    }
    this._newProblem(false);   // 다음 문제로 교체(벽돌 보기도 새로 적힘)
  }

  _onWrong() {
    this.wrong += 1;
    this._addScore(-20);       // 감점은 소폭. 게임오버는 절대 아니다.
    this._emitStats();
    this.feedback = { ok: false, val: this.problem.answer, timer: 2.0 };
    // 정답 벽돌이 남아 있는지 확인하고, 없으면 보기를 다시 적어 준다.
    const stillThere = this.bricks.some((x) => x.alive && x.correct);
    if (!stillThere) this._labelBricks();
  }

  // 각도 하한: 수평·수직 무한 반사 방지 + 속도 상한 유지
  _enforceAngle() {
    const b = this.ball;
    let sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) return;
    if (sp > SPEED_MAX) sp = SPEED_MAX;
    let vx = b.vx, vy = b.vy;
    const minVy = sp * MIN_VY_RATIO;
    const minVx = sp * MIN_VX_RATIO;
    if (Math.abs(vy) < minVy) {
      vy = (vy < 0 ? -1 : 1) * minVy;
      vx = (vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, sp * sp - vy * vy));
    }
    if (Math.abs(vx) < minVx) {
      const sign = vx === 0 ? (Math.random() < 0.5 ? -1 : 1) : (vx < 0 ? -1 : 1);
      vx = sign * minVx;
      vy = (vy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, sp * sp - vx * vx));
    }
    const cur = Math.hypot(vx, vy) || 1;
    b.vx = (vx / cur) * sp;
    b.vy = (vy / cur) * sp;
  }

  _loseLife() {
    this.lives -= 1;
    this.flash = 0.6;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'over';
      if (typeof this.onGameOver === 'function') this.onGameOver(this.score);
      return;
    }
    this._resetBall();
    this.state = 'ready';
  }

  // ===== 분수 그리기 =====

  // 값 하나의 가로 폭을 잰다
  _valWidth(val, size) {
    const ctx = this.ctx;
    const fs = Math.round(size * 0.85);
    if (val.t === 'int') {
      ctx.font = '700 ' + size + 'px ' + FONT;
      return ctx.measureText(String(val.v)).width;
    }
    if (val.t === 'frac') {
      ctx.font = '700 ' + fs + 'px ' + FONT;
      const wn = ctx.measureText(String(val.n)).width;
      const wd = ctx.measureText(String(val.d)).width;
      return Math.max(wn, wd) + 14;
    }
    ctx.font = '700 ' + size + 'px ' + FONT;
    const ww = ctx.measureText(String(val.w)).width;
    return ww + 8 + this._valWidth({ t: 'frac', n: val.n, d: val.d }, size);
  }

  // 왼쪽 x, 세로 가운데 cy 기준으로 그리고 그린 폭을 돌려준다
  _drawValAt(val, x, cy, size, color) {
    const ctx = this.ctx;
    const fs = Math.round(size * 0.85);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    if (val.t === 'int') {
      ctx.font = '700 ' + size + 'px ' + FONT;
      ctx.textAlign = 'left';
      ctx.fillText(String(val.v), x, cy);
      return ctx.measureText(String(val.v)).width;
    }
    if (val.t === 'frac') {
      const w = this._valWidth(val, size);
      ctx.font = '700 ' + fs + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(String(val.n), x + w / 2, cy - fs * 0.64);   // 분자
      ctx.fillText(String(val.d), x + w / 2, cy + fs * 0.66);   // 분모
      ctx.strokeStyle = color;                                   // 가로줄
      ctx.lineWidth = Math.max(2, Math.round(size / 12));
      ctx.beginPath();
      ctx.moveTo(x + 3, cy);
      ctx.lineTo(x + w - 3, cy);
      ctx.stroke();
      return w;
    }
    // 대분수: 자연수 + 분수
    ctx.font = '700 ' + size + 'px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(String(val.w), x, cy);
    const ww = ctx.measureText(String(val.w)).width;
    const fw = this._drawValAt({ t: 'frac', n: val.n, d: val.d }, x + ww + 8, cy, size, color);
    return ww + 8 + fw;
  }

  // 문제 줄(글자 조각 + 분수 조각)을 가운데 정렬해서 그린다
  _drawTokens(tokens, cy, size, color) {
    const ctx = this.ctx;
    const gap = 12;
    let total = 0;
    const widths = tokens.map((tk) => {
      let w;
      if (tk.t === 'text') { ctx.font = '700 ' + size + 'px ' + FONT; w = ctx.measureText(tk.s).width; }
      else w = this._valWidth(tk, size);
      total += w;
      return w;
    });
    total += gap * (tokens.length - 1);
    let x = (W - total) / 2;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.t === 'text') {
        ctx.fillStyle = color;
        ctx.font = '700 ' + size + 'px ' + FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tk.s, x, cy);
      } else {
        this._drawValAt(tk, x, cy, size, color);
      }
      x += widths[i] + gap;
    }
  }

  // ===== 화면 =====

  _draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);   // 매 프레임 배경 새로 칠하기
    this._drawField();
    this._drawBricks();
    this._drawPaddle();
    this._drawBall();
    this._drawHUD();
    this._drawQuestion();
    this._drawFeedback();
    this._drawOverlay();
  }

  _drawField() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1d2033';
    ctx.fillRect(0, FIELD_TOP - WALL, W, WALL);
    ctx.fillRect(0, FIELD_TOP - WALL, WALL, H - FIELD_TOP + WALL);
    ctx.fillRect(W - WALL, FIELD_TOP - WALL, WALL, H - FIELD_TOP + WALL);
  }

  _drawBricks() {
    const ctx = this.ctx;
    for (const k of this.bricks) {
      if (!k.alive || !k.val) continue;
      ctx.fillStyle = ROW_FILL[k.row % ROW_FILL.length];
      ctx.fillRect(k.x, k.y, k.w, k.h);
      ctx.strokeStyle = ROW_EDGE[k.row % ROW_EDGE.length];
      ctx.lineWidth = 2;
      ctx.strokeRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2);
      // 보기(분수)를 벽돌 가운데에
      const vw = this._valWidth(k.val, 26);
      this._drawValAt(k.val, k.x + (k.w - vw) / 2, k.y + k.h / 2, 26, '#ffffff');
    }
  }

  _drawPaddle() {
    const ctx = this.ctx;
    const p = this.paddle;
    ctx.fillStyle = '#e9eefc';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#5b6bff';
    ctx.fillRect(p.x + p.w / 2 - 3, p.y, 6, p.h);
  }

  _drawBall() {
    const ctx = this.ctx;
    const b = this.ball;
    ctx.fillStyle = '#fff45a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b0b12';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawHUD() {
    const ctx = this.ctx;
    ctx.fillStyle = '#141626';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.font = '700 22px ' + FONT;
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + String(this.score).padStart(4, '0'), 16, HUD_H / 2);

    ctx.fillStyle = '#ffd166';
    ctx.fillText('목숨 ' + (this.lives > 0 ? '♥'.repeat(this.lives) : '없음'), 170, HUD_H / 2);

    ctx.fillStyle = '#8fe1ff';
    ctx.fillText('스테이지 ' + this.stage, 340, HUD_H / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9d3ff';
    ctx.fillText('맞힘 ' + this.correct + '  ·  틀림 ' + this.wrong + '  ·  이번 판 ' + this.solved + '/' + STAGE_GOAL, W - 16, HUD_H / 2);
  }

  _drawQuestion() {
    const ctx = this.ctx;
    ctx.fillStyle = '#171a2e';
    ctx.fillRect(0, Q_TOP, W, Q_BOTTOM - Q_TOP);
    ctx.strokeStyle = '#5b6bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, Q_BOTTOM - 1);
    ctx.lineTo(W, Q_BOTTOM - 1);
    ctx.stroke();
    if (this.problem) {
      this._drawTokens(this.problem.tokens, (Q_TOP + Q_BOTTOM) / 2, 32, '#ffffff');
    }
  }

  // 정답/오답 알림 — 색만 쓰지 않고 O·X 기호와 글자를 함께 보여 준다
  _drawFeedback() {
    if (!this.feedback) return;
    const ctx = this.ctx;
    const fb = this.feedback;
    const boxH = 62;
    const y = H - 120;
    ctx.fillStyle = fb.ok ? 'rgba(20,70,45,0.92)' : 'rgba(80,30,30,0.92)';
    ctx.fillRect(70, y, W - 140, boxH);
    ctx.strokeStyle = fb.ok ? '#7dffb0' : '#ffb3a8';
    ctx.lineWidth = 3;
    ctx.strokeRect(70, y, W - 140, boxH);

    const cy = y + boxH / 2;
    if (fb.ok) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('O   정답!  잘했어요', W / 2, cy);
    } else {
      // "X 아쉬워요 — 정답은 [분수]" 를 가운데 정렬로 그린다
      const head = 'X  아쉬워요.  정답은';
      ctx.font = '700 26px ' + FONT;
      const hw = ctx.measureText(head).width;
      const vw = this._valWidth(fb.val, 26);
      ctx.font = '700 26px ' + FONT;
      const tw = ctx.measureText('예요').width;
      const total = hw + 10 + vw + 8 + tw;
      let x = (W - total) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 26px ' + FONT;
      ctx.fillText(head, x, cy);
      x += hw + 10;
      x += this._drawValAt(fb.val, x, cy, 26, '#ffe08a') + 8;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '700 26px ' + FONT;
      ctx.fillText('예요', x, cy);
    }
  }

  _panel(y, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,8,18,0.88)';
    ctx.fillRect(60, y, W - 120, h);
    ctx.strokeStyle = '#5b6bff';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, y, W - 120, h);
  }

  _drawOverlay() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'ready') {
      this._panel(H / 2 - 70, 132);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 32px ' + FONT;
      ctx.fillText('스페이스바를 눌러 공을 쏘세요', W / 2, H / 2 - 26);
      ctx.font = '600 22px ' + FONT;
      ctx.fillStyle = '#c9d3ff';
      ctx.fillText('위 문제의 정답이 적힌 벽돌을 맞히면 점수를 얻어요', W / 2, H / 2 + 8);
      ctx.fillText('← → 이동  ·  P 잠깐 멈춤  ·  R 다시 하기', W / 2, H / 2 + 40);
      return;
    }
    if (this.state === 'paused') {
      this._panel(H / 2 - 55, 110);
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 40px ' + FONT;
      ctx.fillText('잠깐 멈춤', W / 2, H / 2 - 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px ' + FONT;
      ctx.fillText('P키를 다시 누르면 이어서 합니다', W / 2, H / 2 + 28);
      return;
    }
    if (this.state === 'stageclear') {
      this._panel(H / 2 - 70, 132);
      ctx.fillStyle = '#7dffb0';
      ctx.font = '700 36px ' + FONT;
      ctx.fillText('스테이지 ' + this.stage + ' 성공!', W / 2, H / 2 - 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px ' + FONT;
      ctx.fillText('문제 ' + STAGE_GOAL + '개를 맞혔어요', W / 2, H / 2 + 8);
      ctx.fillStyle = '#c9d3ff';
      ctx.fillText('다음 판은 공이 조금 빨라집니다', W / 2, H / 2 + 40);
      return;
    }
    if (this.state === 'over') {
      this._panel(H / 2 - 90, 180);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '700 46px ' + FONT;
      ctx.fillText('게임 끝', W / 2, H / 2 - 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 28px ' + FONT;
      ctx.fillText('점수 ' + this.score + '  ·  맞힘 ' + this.correct + '  ·  틀림 ' + this.wrong, W / 2, H / 2 + 2);
      ctx.font = '600 24px ' + FONT;
      ctx.fillStyle = '#c9d3ff';
      ctx.fillText('R키를 누르면 다시 시작해요', W / 2, H / 2 + 46);
      return;
    }
    if (this.flash > 0) {   // 공을 놓친 직후 짧게 붉은 표시
      ctx.fillStyle = 'rgba(255,80,80,' + (0.35 * this.flash).toFixed(3) + ')';
      ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);
    }
  }
}
