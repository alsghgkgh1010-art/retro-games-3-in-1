/**
 * 연산 지렁이 (Math Snake)
 * 초등 4~6학년 사칙연산 학습용 지렁이 게임
 * 학습게임 공통 인터페이스 계약 v2 준수 (learn/INTERFACE.md)
 *
 * - 논리 해상도 800 x 600 고정
 * - 화면 위쪽 120px = 문제 띠(문제를 44px 굵게 표시), 그 아래 800 x 480 이 격자
 * - 격자: 40px x 40px → 20칸 x 12칸
 * - 격자 위에 숫자 먹이 4개(정답 1 + 오답 3). 정답을 먹으면 몸이 길어지고 다음 문제로 교체
 * - 오답을 먹어도 게임오버가 아니다. 소폭 감점 + X 표시 + 정답 안내
 * - 게임오버는 벽 충돌 / 자기 몸 충돌일 때만
 * - 외부 라이브러리 / CDN / 폰트 / 이미지 / 소리 전부 사용하지 않음
 */

// ── 화면 상수 ───────────────────────────────────────
const W = 800;              // 캔버스 가로
const H = 600;              // 캔버스 세로
const BAND = 120;           // 위쪽 문제 띠 높이
const CELL = 40;            // 한 칸 크기(px)
const COLS = 20;            // 가로 칸 수 (40 * 20 = 800)
const ROWS = 12;            // 세로 칸 수 (40 * 12 = 480)
const GY = BAND;            // 격자가 시작하는 y 좌표

// ── 게임 규칙 상수 ──────────────────────────────────
const TICK_START = 340;     // 시작 이동 간격(ms) — 생각할 시간을 넉넉히
const TICK_MIN = 190;       // 최소 이동 간격(ms)
const TICK_STEP = 8;        // 정답 하나당 빨라지는 정도(ms)
const SCORE_RIGHT = 10;     // 정답 먹이 점수
const SCORE_WRONG = 4;      // 오답 먹이 감점
const FEEDBACK_MS = 1600;   // 정답/오답 안내 표시 시간(ms)
const MIN_LEN = 3;          // 몸 최소 길이

const BEST_KEY = 'learn-math-snake-best';
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';

// 색상 (색만으로 구분하지 않도록 O/X 기호와 글자를 항상 함께 쓴다)
const C_BG = '#0b0b12';
const C_BAND = '#16162a';
const C_GRID = 'rgba(255,255,255,0.06)';
const C_WALL = '#3a3a5c';
const C_BODY = '#2fbf71';
const C_BODY_EDGE = '#0e5c37';
const C_HEAD = '#9dff6b';
const C_HEAD_EDGE = '#0b3d22';
const C_FOOD = '#f4f4ff';
const C_FOOD_EDGE = '#ffd76b';
const C_FOOD_TEXT = '#16162a';
const C_TEXT = '#ffffff';
const C_SUB = '#c9c9e0';
const C_OK = '#7de1a8';
const C_NO = '#ff9b9b';

// ── 작은 도구 함수 ──────────────────────────────────
/** a 이상 b 이하의 정수 하나 */
function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** 배열에서 하나 무작위로 뽑기 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 배열 섞기(피셔-예이츠) */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** 최고 점수 읽기 (학교 PC에서 저장이 막혀 있어도 게임이 죽지 않게) */
function loadBest() {
  try {
    const v = window.localStorage.getItem(BEST_KEY);
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

/** 최고 점수 저장 */
function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch (e) {
    /* 저장이 막힌 환경이면 조용히 무시 */
  }
}

/** 보기로 쓸 수 있는 값인지 확인 (0 이상 999 이하의 정수) */
function usable(v) {
  return Number.isInteger(v) && v >= 0 && v <= 999;
}

// ── 문제 만들기 ─────────────────────────────────────
/**
 * 문제 하나를 만든다.
 * 반환: { text: '7 × 8 = ?', answer: 56, wrongs: [흔한 실수값 후보들], kind: '곱셈' }
 * - 정답은 반드시 코드로 계산한다(사람이 적은 값을 쓰지 않는다).
 * - wrongs 는 "흔한 실수 값" 후보이며, 뒤에서 정답과 중복되지 않도록 다시 걸러진다.
 * @param {boolean} easyOnly 시작 직후처럼 쉬운 유형만 낼지 여부
 */
function makeProblem(easyOnly) {
  const kinds = easyOnly
    ? ['곱셈구구', '큰수덧셈']
    : ['곱셈구구', '곱셈', '나눗셈', '혼합계산', '큰수덧셈', '큰수뺄셈', '괄호식'];
  const kind = pick(kinds);

  // 1) 곱셈구구
  if (kind === '곱셈구구') {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const ans = a * b;
    return {
      kind, text: a + ' × ' + b + ' = ?', answer: ans,
      wrongs: [ans + a, ans - a, ans + b, ans - b, a + b, (a + 1) * b]
    };
  }

  // 2) (두 자리) × (한 자리)
  if (kind === '곱셈') {
    const a = randInt(11, 49);
    const b = randInt(2, 9);
    const ans = a * b;
    const tens = Math.floor(a / 10);
    const ones = a % 10;
    return {
      kind, text: a + ' × ' + b + ' = ?', answer: ans,
      // 흔한 실수: 십의 자리를 빼먹기, 올림 잊기, 한 묶음 더/덜 세기
      wrongs: [ones * b, tens * b, ans + a, ans - a, ans + b, ans - b]
    };
  }

  // 3) (두 자리) ÷ (한 자리) — 나누어떨어지는 것만
  if (kind === '나눗셈') {
    const d = randInt(2, 9);           // 나누는 수
    const q = randInt(2, 12);          // 몫(정답)
    const n = d * q;                   // 나누어지는 수 — 반드시 나누어떨어진다
    return {
      kind, text: n + ' ÷ ' + d + ' = ?', answer: q,
      // 흔한 실수: 몫을 하나 더/덜 세기, 나누는 수와 몫을 헷갈리기
      wrongs: [q + 1, q - 1, q + 2, d, n - d, q * 2]
    };
  }

  // 4) 세 수의 혼합 계산 — 곱셈·나눗셈을 먼저 하는 규칙 익히기
  if (kind === '혼합계산') {
    const form = randInt(1, 3);
    if (form === 1) {
      // a + b × c
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const a = randInt(2, 30);
      const ans = a + b * c;
      // 흔한 실수: 앞에서부터 순서대로 계산 → (a + b) × c
      return {
        kind, text: a + ' + ' + b + ' × ' + c + ' = ?', answer: ans,
        wrongs: [(a + b) * c, a + b + c, ans + c, ans - c, ans + b]
      };
    }
    if (form === 2) {
      // a × b + c
      const a = randInt(2, 12);
      const b = randInt(2, 9);
      const c = randInt(2, 40);
      const ans = a * b + c;
      // 흔한 실수: 뒤쪽 덧셈을 먼저 → a × (b + c)
      return {
        kind, text: a + ' × ' + b + ' + ' + c + ' = ?', answer: ans,
        wrongs: [a * (b + c), a + b + c, ans + a, ans - a, ans + b]
      };
    }
    // a - b × c (결과가 0 이상이 되도록 a 를 정한다)
    const b = randInt(2, 9);
    const c = randInt(2, 9);
    const bc = b * c;
    const a = bc + randInt(1, 40);
    const ans = a - bc;
    // 흔한 실수: 앞에서부터 계산 → (a - b) × c
    return {
      kind, text: a + ' - ' + b + ' × ' + c + ' = ?', answer: ans,
      wrongs: [(a - b) * c, a - b - c, a - b + c, ans + c, ans - c]
    };
  }

  // 5) 큰 수의 덧셈 (세 자리 이내)
  if (kind === '큰수덧셈') {
    const a = randInt(105, 480);
    const b = randInt(105, 480);
    const ans = a + b;
    return {
      kind, text: a + ' + ' + b + ' = ?', answer: ans,
      // 흔한 실수: 받아올림을 빠뜨려 10 또는 100이 모자람
      wrongs: [ans - 10, ans - 100, ans + 10, ans + 1, ans - 1]
    };
  }

  // 6) 큰 수의 뺄셈 (결과가 음수가 되지 않게)
  if (kind === '큰수뺄셈') {
    const a = randInt(220, 980);
    const b = randInt(105, a - 20);
    const ans = a - b;
    return {
      kind, text: a + ' - ' + b + ' = ?', answer: ans,
      // 흔한 실수: 받아내림을 빠뜨림
      wrongs: [ans + 10, ans + 100, ans - 10, ans + 1, ans - 1]
    };
  }

  // 7) 괄호가 있는 식 — 괄호 먼저 계산하기
  {
    const c = randInt(2, 9);
    if (Math.random() < 0.5) {
      // (a - b) × c
      const diff = randInt(2, 9);
      const b = randInt(2, 20);
      const a = b + diff;
      const ans = diff * c;
      // 흔한 실수: 괄호를 무시하고 a - (b × c)
      const slip = a - b * c;
      return {
        kind, text: '(' + a + ' - ' + b + ') × ' + c + ' = ?', answer: ans,
        wrongs: [slip, a - b + c, ans + c, ans - c, ans + diff]
      };
    }
    // (a + b) × c
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    const ans = (a + b) * c;
    // 흔한 실수: 괄호를 무시하고 a + (b × c)
    return {
      kind, text: '(' + a + ' + ' + b + ') × ' + c + ' = ?', answer: ans,
      wrongs: [a + b * c, a + b + c, ans + c, ans - c, ans - a]
    };
  }
}

/**
 * 문제 하나에 대해 보기 4개(정답 1 + 오답 3)를 만든다.
 * 규칙: 오답에 정답과 같은 값이 절대 들어가지 않고, 오답끼리도 중복되지 않는다.
 * @returns {{text:string, answer:number, kind:string, choices:number[]}}
 */
function makeQuestion(easyOnly) {
  const p = makeProblem(easyOnly);
  const ans = p.answer;
  const used = new Set([ans]);
  const wrongs = [];

  // (1) 흔한 실수 값을 먼저 채운다 — 교육적으로 의미 있는 오답
  for (const v of shuffle(p.wrongs.slice())) {
    if (wrongs.length >= 3) break;
    if (!usable(v) || used.has(v)) continue;
    used.add(v);
    wrongs.push(v);
  }

  // (2) 모자라면 정답 근처의 값으로 채운다
  let guard = 0;
  while (wrongs.length < 3 && guard < 300) {
    guard++;
    const delta = randInt(1, 12) * (Math.random() < 0.5 ? -1 : 1);
    const v = ans + delta;
    if (!usable(v) || used.has(v)) continue;
    used.add(v);
    wrongs.push(v);
  }

  // (3) 그래도 모자라면 0부터 훑어서 채운다(정답이 0 근처일 때의 안전장치)
  for (let v = 0; v <= 999 && wrongs.length < 3; v++) {
    if (used.has(v)) continue;
    used.add(v);
    wrongs.push(v);
  }

  return {
    text: p.text,
    answer: ans,
    kind: p.kind,
    choices: shuffle([ans].concat(wrongs))
  };
}

// ── 게임 클래스 ─────────────────────────────────────
export default class MathSnake {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 루프/리스너 관련 필드 (여기서 시작하지 않는다)
    this._rafId = 0;
    this._running = false;
    this._lastTime = 0;
    this._acc = 0;

    // 리스너는 바인딩된 참조를 필드에 보관해서 stop()에서 정확히 제거
    this._onKeyDown = this._onKeyDown.bind(this);
    this._frame = this._frame.bind(this);

    // 셸 연동 훅(없어도 정상 동작)
    this.onScore = null;
    this.onGameOver = null;
    this.onStats = null;

    this.best = 0;
    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this._reset();
  }

  // ── 상태 초기화 ──────────────────────────────────
  /** 새 판 준비 */
  _reset() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];
    this.dir = { x: 1, y: 0 };   // 현재 진행 방향
    this.queue = [];             // 입력 큐(연속 입력이 꼬이지 않게)

    this.score = 0;
    this.correct = 0;
    this.wrong = 0;
    this.tickMs = TICK_START;
    this.paused = false;
    this.gameOver = false;
    this.started = false;        // 첫 방향키 입력 전에는 대기
    this._acc = 0;
    this._blink = 0;

    this.feedback = null;        // { ok:boolean, msg:string, left:number }
    this.question = null;
    this.lastText = '';
    this.foods = [];

    this.best = loadBest();
    this._nextQuestion();

    this.onScore?.(this.score);
    this.onStats?.({ correct: this.correct, wrong: this.wrong });
  }

  /** 새 문제를 뽑고 먹이 4개를 격자에 배치 */
  _nextQuestion() {
    const easyOnly = this.correct < 3;   // 시작 30초는 누구나 성공할 수 있게
    let q = makeQuestion(easyOnly);
    let guard = 0;
    // 같은 문제가 연속으로 나오지 않게
    while (q.text === this.lastText && guard < 20) { q = makeQuestion(easyOnly); guard++; }
    this.lastText = q.text;
    this.question = q;
    this._placeFoods(q.choices);
  }

  /** 값 목록을 서로 떨어진 빈 칸에 배치 */
  _placeFoods(values) {
    const occupied = new Set(this.snake.map(s => s.y * COLS + s.x));
    const head = this.snake[0];
    const spots = [];

    let guard = 0;
    while (spots.length < values.length && guard < 3000) {
      guard++;
      const x = randInt(0, COLS - 1);
      const y = randInt(0, ROWS - 1);
      if (occupied.has(y * COLS + x)) continue;
      // 머리 바로 앞에 붙어서 실수로 먹히지 않게 3칸 이상 떨어뜨린다
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < 4) continue;
      // 먹이끼리도 충분히 떨어뜨린다(숫자 글상자가 겹치지 않게)
      let ok = true;
      for (const s of spots) {
        if (Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 2) { ok = false; break; }
      }
      if (!ok) continue;
      spots.push({ x, y });
    }
    // 아주 드물게 자리를 못 찾으면 남은 빈 칸 아무 데나 채운다
    if (spots.length < values.length) {
      for (let y = 0; y < ROWS && spots.length < values.length; y++) {
        for (let x = 0; x < COLS && spots.length < values.length; x++) {
          if (occupied.has(y * COLS + x)) continue;
          if (spots.some(s => s.x === x && s.y === y)) continue;
          spots.push({ x, y });
        }
      }
    }

    this.foods = spots.map((s, i) => ({
      x: s.x, y: s.y,
      value: values[i],
      isAnswer: values[i] === this.question.answer
    }));
  }

  /** 오답 먹이 하나를 새 자리·새 값으로 다시 놓는다(문제는 그대로) */
  _respawnWrongFood(old) {
    const used = new Set(this.foods.map(f => f.value));
    used.add(this.question.answer);
    used.add(old.value);
    let value = null;
    for (let t = 0; t < 200; t++) {
      const v = this.question.answer + randInt(1, 15) * (Math.random() < 0.5 ? -1 : 1);
      if (usable(v) && !used.has(v)) { value = v; break; }
    }
    if (value === null) {
      for (let v = 0; v <= 999; v++) { if (!used.has(v)) { value = v; break; } }
    }

    const occupied = new Set(this.snake.map(s => s.y * COLS + s.x));
    let spot = null;
    const head = this.snake[0];
    for (let t = 0; t < 800; t++) {
      const x = randInt(0, COLS - 1);
      const y = randInt(0, ROWS - 1);
      if (occupied.has(y * COLS + x)) continue;
      if (Math.abs(x - head.x) + Math.abs(y - head.y) < 4) continue;
      let ok = true;
      for (const f of this.foods) {
        if (Math.abs(f.x - x) < 3 && Math.abs(f.y - y) < 2) { ok = false; break; }
      }
      if (!ok) continue;
      spot = { x, y };
      break;
    }
    if (!spot) return;   // 자리가 없으면 그냥 먹이 하나가 줄어든 채로 진행
    this.foods.push({ x: spot.x, y: spot.y, value, isAnswer: false });
  }

  // ── 생명주기 ─────────────────────────────────────
  /** 루프 시작 + 키 리스너 등록. 중복 호출 안전 */
  start() {
    if (this._running) return;
    this._running = true;
    this._reset();
    window.addEventListener('keydown', this._onKeyDown);
    this._lastTime = 0;
    this._rafId = window.requestAnimationFrame(this._frame);
  }

  /** 루프 정지 + 리스너 해제 + 타이머 정리. 중복 호출 안전 */
  stop() {
    if (this._rafId) {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    if (this._running) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    this._running = false;
  }

  // ── 입력 ─────────────────────────────────────────
  _onKeyDown(e) {
    const k = e.key;
    const code = e.code;

    // 방향키·스페이스로 화면이 스크롤되지 않게 막는다
    if (
      code === 'ArrowUp' || code === 'ArrowDown' ||
      code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Space'
    ) {
      e.preventDefault();
    }

    // R: 다시하기
    if (k === 'r' || k === 'R' || code === 'KeyR') {
      this._reset();
      return;
    }

    // P: 일시정지 (게임 오버 상태에서는 무시)
    if (k === 'p' || k === 'P' || code === 'KeyP') {
      if (!this.gameOver) this.paused = !this.paused;
      return;
    }

    if (this.gameOver) return;

    let nd = null;
    if (code === 'ArrowUp' || code === 'KeyW') nd = { x: 0, y: -1 };
    else if (code === 'ArrowDown' || code === 'KeyS') nd = { x: 0, y: 1 };
    else if (code === 'ArrowLeft' || code === 'KeyA') nd = { x: -1, y: 0 };
    else if (code === 'ArrowRight' || code === 'KeyD') nd = { x: 1, y: 0 };
    if (!nd) return;

    // 일시정지 중 방향키를 누르면 자연스럽게 이어서 진행
    if (this.paused) this.paused = false;

    // 아직 시작 전이면 첫 입력으로 출발
    if (!this.started) { this.started = true; this._acc = 0; }

    this._pushDir(nd);
  }

  /**
   * 입력 큐에 방향을 넣는다.
   * 큐의 마지막 방향(없으면 현재 방향)을 기준으로
   * 정반대·중복 방향은 버려서 자기 목에 박는 즉사를 막는다.
   */
  _pushDir(nd) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (nd.x === -last.x && nd.y === -last.y) return; // 정반대 금지
    if (nd.x === last.x && nd.y === last.y) return;   // 같은 방향 중복 금지
    if (this.queue.length >= 3) return;               // 큐 과다 방지
    this.queue.push(nd);
  }

  // ── 루프 ─────────────────────────────────────────
  _frame(now) {
    if (!this._running) return;
    if (!this._lastTime) this._lastTime = now;
    let dt = now - this._lastTime;
    this._lastTime = now;
    if (dt > 250) dt = 250; // 탭 전환 등으로 멈췄다 돌아온 경우 보정

    this._blink += dt;

    if (this.feedback) {
      this.feedback.left -= dt;
      if (this.feedback.left <= 0) this.feedback = null;
    }

    if (this.started && !this.paused && !this.gameOver) {
      this._acc += dt;
      let guard = 0;
      while (this._acc >= this.tickMs && !this.gameOver && guard < 5) {
        this._acc -= this.tickMs;
        this._step();
        guard++;
      }
    }

    this._draw();
    this._rafId = window.requestAnimationFrame(this._frame);
  }

  /** 한 칸 이동 */
  _step() {
    // 큐에서 방향 하나 꺼내기
    if (this.queue.length) {
      const nd = this.queue.shift();
      if (!(nd.x === -this.dir.x && nd.y === -this.dir.y)) this.dir = nd;
    }

    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    // 벽 충돌 → 게임 오버
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { this._die(); return; }

    const idx = this.foods.findIndex(f => f.x === nx && f.y === ny);
    const eaten = idx >= 0 ? this.foods[idx] : null;
    const willGrow = !!eaten && eaten.isAnswer;

    // 자기 몸 충돌 → 게임 오버 (꼬리 끝은 이번 틱에 비워지므로 제외)
    const limit = willGrow ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].x === nx && this.snake[i].y === ny) { this._die(); return; }
    }

    this.snake.unshift({ x: nx, y: ny });
    if (!willGrow) this.snake.pop();

    if (!eaten) return;

    if (eaten.isAnswer) {
      // 정답: 몸 +1, 점수 +, 다음 문제로
      this.correct++;
      this.score += SCORE_RIGHT;
      this.tickMs = Math.max(TICK_MIN, this.tickMs - TICK_STEP);
      this.feedback = { ok: true, msg: '정답!  ' + this.question.text.replace(' = ?', ' = ' + this.question.answer), left: FEEDBACK_MS };
      if (this.score > this.best) { this.best = this.score; saveBest(this.best); }
      this.onScore?.(this.score);
      this.onStats?.({ correct: this.correct, wrong: this.wrong });
      this._nextQuestion();
    } else {
      // 오답: 게임오버가 아니다. 소폭 감점 + 정답 안내 + 몸 1칸만 줄임
      this.wrong++;
      this.score = Math.max(0, this.score - SCORE_WRONG);
      this.feedback = { ok: false, msg: '아쉬워요.  정답은 ' + this.question.answer + ' 이에요', left: FEEDBACK_MS };
      if (this.snake.length > MIN_LEN) this.snake.pop();
      this.foods.splice(idx, 1);
      this._respawnWrongFood(eaten);
      this.onScore?.(this.score);
      this.onStats?.({ correct: this.correct, wrong: this.wrong });
    }
  }

  /** 게임 오버 처리 */
  _die() {
    this.gameOver = true;
    this.feedback = null;
    if (this.score > this.best) { this.best = this.score; saveBest(this.best); }
    this.onGameOver?.(this.score);
  }

  // ── 그리기 ───────────────────────────────────────
  _draw() {
    const ctx = this.ctx;

    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    this._drawGrid();
    this._drawFoods();
    this._drawSnake();
    this._drawWalls();
    this._drawBand();

    if (this.feedback && !this.gameOver) this._drawFeedback();

    if (!this.started && !this.gameOver) this._drawReady();
    else if (this.paused && !this.gameOver) this._drawPaused();
    else if (this.gameOver) this._drawGameOver();
  }

  /** 은은한 격자 선 — 위치 파악을 쉽게 */
  _drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = C_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, GY);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, GY + y * CELL + 0.5);
      ctx.lineTo(W, GY + y * CELL + 0.5);
    }
    ctx.stroke();
  }

  /** 격자 바깥 벽 */
  _drawWalls() {
    const ctx = this.ctx;
    ctx.strokeStyle = C_WALL;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, GY + 2, W - 4, H - GY - 4);
  }

  /** 모서리가 둥근 사각형 경로 (roundRect 없는 브라우저 대비 직접 구현) */
  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /** 숫자 먹이: 흰 알약 + 노란 테두리 + 큰 검은 숫자 (색이 아니라 숫자로 고른다) */
  _drawFoods() {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px ' + FONT;

    for (const f of this.foods) {
      const cx = f.x * CELL + CELL / 2;
      const cy = GY + f.y * CELL + CELL / 2;
      const txt = String(f.value);
      const tw = ctx.measureText(txt).width;
      const bw = Math.max(CELL - 6, tw + 16);
      const bh = CELL - 8;

      ctx.fillStyle = C_FOOD;
      this._roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = C_FOOD_EDGE;
      ctx.lineWidth = 3;
      this._roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      ctx.stroke();

      ctx.fillStyle = C_FOOD_TEXT;
      ctx.fillText(txt, cx, cy + 1);
    }
    ctx.restore();
  }

  /** 지렁이: 몸은 사각형+테두리, 머리는 밝은 색 + 눈(진행 방향 표시) */
  _drawSnake() {
    const ctx = this.ctx;

    for (let i = this.snake.length - 1; i >= 1; i--) {
      const s = this.snake[i];
      const px = s.x * CELL;
      const py = GY + s.y * CELL;
      ctx.fillStyle = C_BODY;
      ctx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
      ctx.strokeStyle = C_BODY_EDGE;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 4.5, py + 4.5, CELL - 9, CELL - 9);
    }

    const h = this.snake[0];
    const hx = h.x * CELL;
    const hy = GY + h.y * CELL;
    ctx.fillStyle = C_HEAD;
    ctx.fillRect(hx + 2, hy + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = C_HEAD_EDGE;
    ctx.lineWidth = 3;
    ctx.strokeRect(hx + 3.5, hy + 3.5, CELL - 7, CELL - 7);

    // 눈 두 개 — 진행 방향 쪽으로 치우치게 그려서 방향이 보이게
    const cx = hx + CELL / 2;
    const cy = hy + CELL / 2;
    const d = this.dir;
    const fx = d.x * CELL * 0.22;
    const fy = d.y * CELL * 0.22;
    const sx = -d.y * CELL * 0.20;
    const sy = d.x * CELL * 0.20;

    ctx.fillStyle = C_HEAD_EDGE;
    for (const sign of [1, -1]) {
      ctx.beginPath();
      ctx.arc(cx + fx + sx * sign, cy + fy + sy * sign, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 위쪽 문제 띠 */
  _drawBand() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = C_BAND;
    ctx.fillRect(0, 0, W, BAND);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, BAND - 1);
    ctx.lineTo(W, BAND - 1);
    ctx.stroke();

    ctx.textBaseline = 'middle';

    // 윗줄: 점수 / 정답·오답 / 최고
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = C_TEXT;
    ctx.fillText('점수 ' + this.score, 16, 24);

    ctx.textAlign = 'center';
    ctx.fillStyle = C_SUB;
    ctx.fillText('맞힘 O ' + this.correct + '   틀림 X ' + this.wrong, W / 2, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd76b';
    ctx.fillText('최고 ' + this.best, W - 16, 24);

    // 아랫줄: 문제 (크고 굵게)
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.question ? this.question.text : '', W / 2, 76);

    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = C_SUB;
    ctx.fillText('정답 숫자를 먹으세요   ·   P 일시정지   ·   R 다시하기', W / 2, 106);
    ctx.restore();
  }

  /** 정답/오답 안내 띠 — 색과 함께 O / X 기호를 반드시 같이 보여준다 */
  _drawFeedback() {
    const ctx = this.ctx;
    const fb = this.feedback;
    const bh = 66;
    const by = GY + 10;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = fb.ok ? '#123a26' : '#3a1420';
    ctx.fillRect(40, by, W - 80, bh);
    ctx.strokeStyle = fb.ok ? C_OK : C_NO;
    ctx.lineWidth = 3;
    ctx.strokeRect(41.5, by + 1.5, W - 83, bh - 3);

    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillStyle = fb.ok ? C_OK : C_NO;
    ctx.fillText(fb.ok ? 'O' : 'X', 62, by + bh / 2);

    ctx.font = 'bold 26px ' + FONT;
    ctx.fillStyle = C_TEXT;
    ctx.fillText(fb.msg, 108, by + bh / 2 + 1);
    ctx.restore();
  }

  /** 가운데 안내 상자 */
  _drawPanel(lines, boxH) {
    const ctx = this.ctx;
    const bw = 660;
    const bx = (W - bw) / 2;
    const by = GY + (H - GY - boxH) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.92)';
    ctx.fillRect(bx, by, bw, boxH);
    ctx.strokeStyle = C_OK;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, boxH - 3);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = by + 44;
    for (const ln of lines) {
      ctx.font = 'bold ' + ln.size + 'px ' + FONT;
      ctx.fillStyle = ln.color;
      ctx.fillText(ln.text, W / 2, y);
      y += ln.size + 16;
    }
    ctx.restore();
  }

  /** 시작 전 안내 */
  _drawReady() {
    this._drawPanel([
      { text: '연산 지렁이', size: 42, color: '#9dff6b' },
      { text: '방향키로 지렁이를 움직이세요', size: 24, color: C_TEXT },
      { text: '위쪽 문제의 정답 숫자를 먹으면 몸이 길어져요', size: 22, color: C_SUB },
      { text: '벽과 자기 몸에 부딪히지 않게 조심하세요', size: 22, color: C_SUB },
      { text: '아무 방향키나 누르면 시작!', size: 26, color: '#ffd76b' }
    ], 300);
  }

  /** 일시정지 */
  _drawPaused() {
    this._drawPanel([
      { text: '잠깐 멈춤', size: 42, color: '#ffd76b' },
      { text: 'P키를 다시 누르면 이어서 합니다', size: 24, color: C_TEXT }
    ], 170);
  }

  /** 게임 오버 */
  _drawGameOver() {
    const isBest = this.score > 0 && this.score >= this.best;
    this._drawPanel([
      { text: '게임 끝!', size: 44, color: C_NO },
      { text: '점수 ' + this.score, size: 30, color: C_TEXT },
      { text: '맞힘 O ' + this.correct + '개   ·   틀림 X ' + this.wrong + '개', size: 24, color: C_SUB },
      { text: isBest ? '최고 기록을 세웠어요!' : '최고 기록 ' + this.best, size: 22, color: '#ffd76b' },
      { text: 'R키를 누르면 다시하기', size: 26, color: C_OK }
    ], 320);
  }

  // 자체 검증용(브라우저 동작과 무관) — 문제 생성기를 밖에서 확인할 때 쓴다
  static _makeQuestion(easyOnly) { return makeQuestion(easyOnly); }
}

// ── 교사용 정보 ─────────────────────────────────────
export const INFO = {
  subject: '수학',
  grade: '4~6학년',
  goal: '곱셈·나눗셈과 혼합 계산에서 계산 순서를 지켜 답을 바르게 구할 수 있다.',
  minutes: 5,
  howto: '방향키로 지렁이를 움직여 위쪽 문제의 정답이 적힌 숫자 먹이를 먹으세요.',
  items: [
    '7 × 8 = 56',
    '9 × 6 = 54',
    '34 × 7 = 238',
    '48 × 5 = 240',
    '96 ÷ 8 = 12',
    '72 ÷ 9 = 8',
    '54 ÷ 6 = 9',
    '12 + 3 × 4 = 24',
    '7 × 6 + 15 = 57',
    '50 - 4 × 8 = 18',
    '(15 - 7) × 3 = 24',
    '(6 + 9) × 4 = 60',
    '286 + 457 = 743',
    '405 + 178 = 583',
    '724 - 356 = 368',
    '900 - 245 = 655'
  ]
};
