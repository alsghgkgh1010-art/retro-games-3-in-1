/**
 * 클래식 스네이크(지렁이) 게임
 * 공통 게임 인터페이스 계약 v1 준수 (games/INTERFACE.md)
 *
 * - 논리 해상도 800 x 600 고정
 * - 격자: 25px x 25px → 32칸 x 24칸 (800 = 25*32, 600 = 25*24)
 * - HUD는 상단 반투명 오버레이로 처리(격자를 가리지 않아 위치 파악이 쉬움)
 * - 외부 라이브러리 / CDN / 폰트 / 이미지 / 소리 전부 사용하지 않음
 */

// ── 상수 ─────────────────────────────────────────────
const CELL = 25;            // 한 칸 크기(px)
const COLS = 32;            // 가로 칸 수 (25 * 32 = 800)
const ROWS = 24;            // 세로 칸 수 (25 * 24 = 600)
const W = CELL * COLS;      // 800
const H = CELL * ROWS;      // 600

const TICK_START = 150;     // 시작 이동 간격(ms) — 느긋하게
const TICK_MIN = 70;        // 최소 이동 간격(ms) — 너무 빨라지지 않게
const TICK_STEP = 3;        // 먹이 하나당 빨라지는 정도(ms)
const SCORE_PER_FOOD = 10;  // 먹이 하나당 점수

const BEST_KEY = 'retro-arcade-snake-best';
const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';

// 색상 (색만으로 구분하지 않도록 모양·테두리도 함께 사용)
const C_BG = '#0b0b12';
const C_GRID = 'rgba(255,255,255,0.06)';
const C_WALL = '#3a3a5c';
const C_BODY = '#2fbf71';
const C_BODY_EDGE = '#0e5c37';
const C_HEAD = '#9dff6b';
const C_HEAD_EDGE = '#0b3d22';
const C_FOOD = '#ff6b6b';
const C_FOOD_EDGE = '#ffe08a';
const C_TEXT = '#ffffff';
const C_SUB = '#c9c9e0';

/** 최고 점수 읽기 (학교 PC에서 차단돼 있어도 게임이 죽지 않게) */
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
    /* 차단된 환경이면 조용히 무시 */
  }
}

export default class Snake {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 루프/리스너 관련 필드 (여기서 시작하지 않음)
    this._rafId = 0;
    this._running = false;
    this._lastTime = 0;
    this._acc = 0;

    // 리스너는 바인딩된 참조를 필드에 보관해서 stop()에서 정확히 제거
    this._onKeyDown = this._onKeyDown.bind(this);
    this._frame = this._frame.bind(this);

    // 선택 콜백
    this.onScore = null;
    this.onGameOver = null;

    this.best = 0;
    this.score = 0;
    this._reset();
  }

  // ── 상태 초기화 ────────────────────────────────────
  /** 새 판 준비 */
  _reset() {
    // 뱀: 가운데에서 오른쪽을 보고 3칸으로 시작
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy }
    ];
    this.dir = { x: 1, y: 0 };   // 현재 진행 방향
    this.queue = [];             // 입력 큐(한 틱에 여러 번 눌러도 안 꼬이게)

    this.score = 0;
    this.tickMs = TICK_START;
    this.paused = false;
    this.gameOver = false;
    this.started = false;        // 첫 방향키 입력 전에는 대기(안내 문구 표시)
    this._acc = 0;
    this._blink = 0;

    this.best = loadBest();
    this._placeFood();
  }

  /** 뱀 몸과 겹치지 않는 빈 칸에만 먹이 생성 */
  _placeFood() {
    const occupied = new Set(this.snake.map(s => s.y * COLS + s.x));
    const empty = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const k = y * COLS + x;
        if (!occupied.has(k)) empty.push(k);
      }
    }
    if (empty.length === 0) { this.food = null; return; } // 화면을 꽉 채운 경우
    const k = empty[Math.floor(Math.random() * empty.length)];
    this.food = { x: k % COLS, y: Math.floor(k / COLS) };
  }

  // ── 생명주기 ──────────────────────────────────────
  /** 루프 시작 + 키 리스너 등록. 중복 호출 안전 */
  start() {
    if (this._running) return;
    this._running = true;
    this._reset();
    window.addEventListener('keydown', this._onKeyDown);
    this._lastTime = 0;
    this._rafId = window.requestAnimationFrame(this._frame);
  }

  /** 루프 정지 + 리스너 해제. 중복 호출 안전 */
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

  // ── 입력 ──────────────────────────────────────────
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

    // R: 재시작
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

    // 일시정지 중 방향키를 누르면 자연스럽게 재개
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

  // ── 루프 ──────────────────────────────────────────
  _frame(now) {
    if (!this._running) return;
    if (!this._lastTime) this._lastTime = now;
    let dt = now - this._lastTime;
    this._lastTime = now;
    if (dt > 250) dt = 250; // 탭 전환 등으로 멈췄다 돌아온 경우 보정

    this._blink += dt;

    if (this.started && !this.paused && !this.gameOver) {
      // 고정 틱 간격(누적 시간 방식)으로 이동
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

    // 벽 충돌
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { this._die(); return; }

    // 자기 몸 충돌 (꼬리 끝은 이번 틱에 비워지므로 제외)
    const willGrow = !!this.food && nx === this.food.x && ny === this.food.y;
    const limit = willGrow ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].x === nx && this.snake[i].y === ny) { this._die(); return; }
    }

    this.snake.unshift({ x: nx, y: ny });

    if (willGrow) {
      // 먹이 획득: 꼬리를 자르지 않아 몸이 1칸 늘어남 + 점수 + 아주 조금 빨라짐
      this.score += SCORE_PER_FOOD;
      this.tickMs = Math.max(TICK_MIN, this.tickMs - TICK_STEP);
      if (this.score > this.best) { this.best = this.score; saveBest(this.best); }
      this.onScore?.(this.score);
      this._placeFood();
    } else {
      this.snake.pop();
    }
  }

  /** 게임 오버 처리 */
  _die() {
    this.gameOver = true;
    if (this.score > this.best) { this.best = this.score; saveBest(this.best); }
    this.onGameOver?.(this.score);
  }

  // ── 그리기 ────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;

    // 배경 (잔상 방지: 매 프레임 전체 칠하기)
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    this._drawGrid();
    this._drawFood();
    this._drawSnake();
    this._drawWalls();
    this._drawHud();

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
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();
  }

  /** 바깥 벽 테두리 */
  _drawWalls() {
    const ctx = this.ctx;
    ctx.strokeStyle = C_WALL;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  /** 먹이: 빨간 원 + 밝은 테두리 (모양으로도 구분) */
  _drawFood() {
    if (!this.food) return;
    const ctx = this.ctx;
    const cx = this.food.x * CELL + CELL / 2;
    const cy = this.food.y * CELL + CELL / 2;
    // 아주 약한 크기 변화로 눈에 띄게(과한 애니메이션은 피함)
    const r = CELL * 0.34 + Math.sin(this._blink / 400) * 1.2;

    ctx.fillStyle = C_FOOD;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = C_FOOD_EDGE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** 뱀: 몸은 사각형+테두리, 머리는 밝은 색 + 눈(진행 방향 표시) */
  _drawSnake() {
    const ctx = this.ctx;

    // 몸통 (뒤에서부터 그려 머리가 위로 오게)
    for (let i = this.snake.length - 1; i >= 1; i--) {
      const s = this.snake[i];
      const px = s.x * CELL;
      const py = s.y * CELL;
      ctx.fillStyle = C_BODY;
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = C_BODY_EDGE;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6);
    }

    // 머리
    const h = this.snake[0];
    const hx = h.x * CELL;
    const hy = h.y * CELL;
    ctx.fillStyle = C_HEAD;
    ctx.fillRect(hx + 1, hy + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = C_HEAD_EDGE;
    ctx.lineWidth = 3;
    ctx.strokeRect(hx + 2.5, hy + 2.5, CELL - 5, CELL - 5);

    // 눈 두 개 — 진행 방향 쪽으로 치우치게 그려서 방향이 보이게
    const cx = hx + CELL / 2;
    const cy = hy + CELL / 2;
    const d = this.dir;
    const fx = d.x * CELL * 0.22;   // 앞쪽 이동량
    const fy = d.y * CELL * 0.22;
    const sx = -d.y * CELL * 0.20;  // 진행 방향의 수직으로 좌우 벌리기
    const sy = d.x * CELL * 0.20;

    ctx.fillStyle = C_HEAD_EDGE;
    for (const sign of [1, -1]) {
      ctx.beginPath();
      ctx.arc(cx + fx + sx * sign, cy + fy + sy * sign, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 상단 HUD(반투명 오버레이) */
  _drawHud() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(11,11,18,0.72)';
    ctx.fillRect(0, 0, W, 44);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 44.5);
    ctx.lineTo(W, 44.5);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillStyle = C_TEXT;
    ctx.textAlign = 'left';
    ctx.fillText('점수 ' + this.score, 16, 23);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd76b';
    ctx.fillText('최고 ' + this.best, W - 16, 23);

    ctx.textAlign = 'center';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillStyle = C_SUB;
    ctx.fillText('P 일시정지 · R 재시작', W / 2, 23);
    ctx.restore();
  }

  /** 가운데 안내 상자 */
  _drawPanel(lines, boxH) {
    const ctx = this.ctx;
    const bw = 580;
    const bx = (W - bw) / 2;
    const by = (H - boxH) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.90)';
    ctx.fillRect(bx, by, bw, boxH);
    ctx.strokeStyle = '#7de1a8';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, boxH - 3);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = by + 46;
    for (const ln of lines) {
      ctx.font = 'bold ' + ln.size + 'px ' + FONT;
      ctx.fillStyle = ln.color;
      ctx.fillText(ln.text, W / 2, y);
      y += ln.size + 18;
    }
    ctx.restore();
  }

  /** 시작 전 안내 */
  _drawReady() {
    this._drawPanel([
      { text: '스네이크', size: 44, color: '#9dff6b' },
      { text: '방향키(또는 WASD)로 움직이세요', size: 24, color: C_TEXT },
      { text: '빨간 먹이를 먹으면 몸이 길어져요', size: 22, color: C_SUB },
      { text: '아무 방향키나 누르면 시작!', size: 24, color: '#ffd76b' }
    ], 250);
  }

  /** 일시정지 */
  _drawPaused() {
    this._drawPanel([
      { text: '일시정지', size: 44, color: '#ffd76b' },
      { text: 'P키를 다시 누르면 계속합니다', size: 24, color: C_TEXT }
    ], 160);
  }

  /** 게임 오버 */
  _drawGameOver() {
    const s = String(this.score).padStart(3, '0');
    const isBest = this.score > 0 && this.score >= this.best;
    this._drawPanel([
      { text: 'GAME OVER', size: 46, color: '#ff8b8b' },
      { text: '점수 ' + s, size: 32, color: C_TEXT },
      { text: isBest ? '최고 기록 달성!' : '최고 기록 ' + this.best, size: 22, color: '#ffd76b' },
      { text: 'R키를 눌러 다시 시작', size: 26, color: C_SUB }
    ], 290);
  }
}
