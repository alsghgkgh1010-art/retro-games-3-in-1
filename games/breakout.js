// 벽돌깨기(Breakout) — 교실용 레트로 아케이드 게임
// 공통 인터페이스 계약 v1 준수: default export 클래스 1개, constructor/start/stop
// 외부 라이브러리·CDN·이미지·소리 없음. 순수 Canvas 2D.

const W = 800;            // 논리 가로 해상도(고정)
const H = 600;            // 논리 세로 해상도(고정)
const BG = '#0b0b12';     // 배경색(계약값)

// 시스템 폰트 스택(웹폰트 금지)
const FONT = 'system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';

// ---- 플레이 영역 ----
const HUD_H = 64;         // 상단 HUD 높이
const WALL = 12;          // 좌우/상단 벽 두께
const FIELD_TOP = HUD_H + WALL;

// ---- 패들 ----
const PADDLE_W = 130;     // 초보 배려: 넉넉한 폭
const PADDLE_H = 16;
const PADDLE_Y = H - 46;
const PADDLE_SPEED = 620; // px/초

// ---- 공 ----
const BALL_R = 9;
const SPEED_BASE = 235;    // 1스테이지 시작 속도(느긋하게)
const SPEED_STEP = 22;     // 스테이지당 상승폭
const SPEED_MAX = 430;     // 속도 상한(무한 가속 방지)
const MIN_VY_RATIO = 0.30; // 수평 갇힘 방지: 세로 속도 최소 비율
const MIN_VX_RATIO = 0.12; // 완전 수직 반복 방지: 가로 속도 최소 비율

// ---- 벽돌 ----
const ROWS = 7;
const COLS = 11;
const BRICK_GAP = 6;
const BRICK_MARGIN_X = 24;
const BRICK_TOP = FIELD_TOP + 24;
const BRICK_H = 26;
const BRICK_W = (W - BRICK_MARGIN_X * 2 - BRICK_GAP * (COLS - 1)) / COLS;
// 윗줄일수록 단단하고 점수가 높다
const ROW_HP = [3, 3, 2, 2, 1, 1, 1];
// 내구도별 색(숫자·무늬와 함께 쓰므로 색만으로 구분하지 않음)
const HP_COLOR = { 3: '#e8503f', 2: '#f0a52a', 1: '#4db9e8' };
const HP_EDGE = { 3: '#ffb3a8', 2: '#ffdca0', 1: '#bfe9ff' };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export default class Breakout {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 콜백 훅(셸이 주입, 없으면 무시)
    this.onScore = null;
    this.onGameOver = null;

    // 리스너는 반드시 고정 참조로 보관(익명 함수 금지)
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._loop = this._loop.bind(this);

    this._rafId = 0;
    this._running = false;
    this._listening = false;
    this._lastTs = 0;

    this.keys = { left: false, right: false };
    this._resetGame();
  }

  // ===== 생명주기 =====

  start() {
    if (this._running) return; // 중복 호출 안전
    this._running = true;
    if (!this._listening) {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this._listening = true;
    }
    // stop() 뒤 재호출이면 새 판으로 시작
    if (this.state === 'over' || this._needFresh) this._resetGame();
    this._needFresh = false;
    this._lastTs = 0;
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (!this._running && !this._listening) return; // 중복 호출 안전
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    if (this._listening) {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      this._listening = false;
    }
    this.keys.left = false;
    this.keys.right = false;
    this._needFresh = true; // 다음 start()는 새 판
  }

  // ===== 상태 초기화 =====

  _resetGame() {
    this.score = 0;
    this.lives = 3;
    this.stage = 1;
    this.state = 'ready';   // ready | playing | paused | stageclear | over
    this.stageTimer = 0;
    this.flash = 0;         // 목숨 감소 시 화면 표시용 타이머
    this._needFresh = false;
    this.paddle = { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
    this._buildStage();
    this._resetBall();
    this._emitScore();
  }

  // 벽돌 재배치
  _buildStage() {
    this.bricks = [];
    for (let r = 0; r < ROWS; r++) {
      const hp = ROW_HP[r % ROW_HP.length];
      for (let c = 0; c < COLS; c++) {
        this.bricks.push({
          x: BRICK_MARGIN_X + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          hp,
          maxHp: hp,
          alive: true,
        });
      }
    }
    this.remaining = this.bricks.length;
  }

  // 공을 패들 위에 붙인다
  _resetBall() {
    this.speed = Math.min(SPEED_BASE + (this.stage - 1) * SPEED_STEP, SPEED_MAX);
    this.ball = {
      x: this.paddle.x + this.paddle.w / 2,
      y: this.paddle.y - BALL_R - 1,
      vx: 0,
      vy: 0,
      stuck: true,
    };
  }

  // 스페이스바 발사: 살짝 비스듬히 위로
  _launch() {
    if (!this.ball.stuck) return;
    const angle = (-Math.PI / 2) + (Math.random() * 0.5 - 0.25); // 위쪽 ±14도
    this.ball.vx = Math.cos(angle) * this.speed;
    this.ball.vy = Math.sin(angle) * this.speed;
    this.ball.stuck = false;
    this.state = 'playing';
    this._enforceAngle();
  }

  _emitScore() {
    if (typeof this.onScore === 'function') this.onScore(this.score);
  }

  _addScore(n) {
    this.score += n;
    this._emitScore();
  }

  // ===== 입력 =====

  _onKeyDown(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown' || k === ' ' || k === 'Spacebar') {
      e.preventDefault(); // 화살표·스페이스 스크롤 방지
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
    if (k === 'r' || k === 'R') {
      this._resetGame();
    }
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
    // 탭 전환 등으로 dt가 크게 튀는 것을 막는다
    const dt = clamp((ts - this._lastTs) / 1000, 0, 0.05);
    this._lastTs = ts;

    this._update(dt);
    this._draw();

    this._rafId = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'paused' || this.state === 'over') return;

    this._movePaddle(dt);

    if (this.state === 'stageclear') {
      this.stageTimer -= dt;
      if (this.stageTimer <= 0) {
        this.stage += 1;
        this._buildStage();
        this._resetBall();
        this.state = 'ready';
      }
      return;
    }

    if (this.ball.stuck) {
      // 발사 전엔 패들에 붙어 따라다닌다
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
    p.x = clamp(p.x, WALL, W - WALL - p.w); // 화면 밖 금지
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
      if (this.state !== 'playing') return; // 목숨 감소 시 중단
      this._collideBricks();
      this._collidePaddle();
      if (this.state !== 'playing') return; // 스테이지 클리어 시 중단
    }
  }

  _collideWalls() {
    const b = this.ball;
    if (b.x - BALL_R < WALL) { b.x = WALL + BALL_R; b.vx = Math.abs(b.vx); this._enforceAngle(); }
    if (b.x + BALL_R > W - WALL) { b.x = W - WALL - BALL_R; b.vx = -Math.abs(b.vx); this._enforceAngle(); }
    if (b.y - BALL_R < FIELD_TOP) { b.y = FIELD_TOP + BALL_R; b.vy = Math.abs(b.vy); this._enforceAngle(); }
    if (b.y - BALL_R > H) this._loseLife(); // 바닥으로 놓침
  }

  _collidePaddle() {
    const b = this.ball;
    const p = this.paddle;
    if (b.vy <= 0) return; // 내려올 때만 판정
    if (b.y + BALL_R < p.y || b.y - BALL_R > p.y + p.h) return;
    if (b.x + BALL_R < p.x || b.x - BALL_R > p.x + p.w) return;

    // 패들의 어느 지점에 맞았는지로 반사각 결정
    // 가운데(0) = 수직, 가장자리(±1) = 최대 ±62도
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
      if (overlapX < overlapY) {
        b.vx = -b.vx;
        b.x += b.vx > 0 ? overlapX : -overlapX;
      } else {
        b.vy = -b.vy;
        b.y += b.vy > 0 ? overlapY : -overlapY;
      }
      this._enforceAngle();

      k.hp -= 1;
      if (k.hp <= 0) {
        k.alive = false;
        this.remaining -= 1;
        this._addScore(k.maxHp * 20);
      } else {
        this._addScore(5); // 단단한 벽돌은 때릴 때마다 소량 점수
      }

      if (this.remaining <= 0) {
        this.state = 'stageclear';
        this.stageTimer = 1.6;
      }
      return; // 한 스텝에 벽돌 하나만 처리
    }
  }

  // 각도 하한: 수평·수직 무한 반사 방지 + 속도 상한 유지
  _enforceAngle() {
    const b = this.ball;
    let sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) return;
    if (sp > SPEED_MAX) sp = SPEED_MAX;

    let vx = b.vx;
    let vy = b.vy;
    const minVy = sp * MIN_VY_RATIO;
    const minVx = sp * MIN_VX_RATIO;

    if (Math.abs(vy) < minVy) {
      vy = (vy < 0 ? -1 : 1) * minVy;
      const rest = Math.max(0, sp * sp - vy * vy);
      vx = (vx < 0 ? -1 : 1) * Math.sqrt(rest);
    }
    if (Math.abs(vx) < minVx) {
      const sign = vx === 0 ? (Math.random() < 0.5 ? -1 : 1) : (vx < 0 ? -1 : 1);
      vx = sign * minVx;
      const rest = Math.max(0, sp * sp - vx * vx);
      vy = (vy < 0 ? -1 : 1) * Math.sqrt(rest);
    }
    // 최종 정규화(속도 상한 고정)
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

  // ===== 그리기 =====

  _draw() {
    const ctx = this.ctx;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H); // 매 프레임 배경 클리어(잔상 방지)

    this._drawField();
    this._drawBricks();
    this._drawPaddle();
    this._drawBall();
    this._drawHUD();
    this._drawOverlay();
  }

  _drawField() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1d2033';
    ctx.fillRect(0, FIELD_TOP - WALL, W, WALL);                            // 상단 벽
    ctx.fillRect(0, FIELD_TOP - WALL, WALL, H - FIELD_TOP + WALL);         // 좌측 벽
    ctx.fillRect(W - WALL, FIELD_TOP - WALL, WALL, H - FIELD_TOP + WALL);  // 우측 벽
  }

  _drawBricks() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const k of this.bricks) {
      if (!k.alive) continue;
      const hp = k.hp;
      ctx.fillStyle = HP_COLOR[hp] || '#8899aa';
      ctx.fillRect(k.x, k.y, k.w, k.h);

      // 무늬로도 내구도 구분(색약 배려): 3=대각선, 2=점, 1=없음
      ctx.save();
      ctx.beginPath();
      ctx.rect(k.x, k.y, k.w, k.h);
      ctx.clip();
      if (hp >= 3) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        for (let d = -k.h; d < k.w; d += 9) {
          ctx.beginPath();
          ctx.moveTo(k.x + d, k.y + k.h);
          ctx.lineTo(k.x + d + k.h, k.y);
          ctx.stroke();
        }
      } else if (hp === 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        for (let px = 8; px < k.w; px += 12) {
          ctx.beginPath();
          ctx.arc(k.x + px, k.y + k.h / 2, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 테두리
      ctx.strokeStyle = HP_EDGE[hp] || '#ffffff';
      ctx.lineWidth = hp >= 3 ? 3 : 2;
      ctx.strokeRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2);

      // 남은 내구도 숫자
      ctx.fillStyle = '#0b0b12';
      ctx.font = '700 20px ' + FONT;
      ctx.fillText(String(hp), k.x + k.w / 2, k.y + k.h / 2 + 1);
    }
  }

  _drawPaddle() {
    const ctx = this.ctx;
    const p = this.paddle;
    ctx.fillStyle = '#e9eefc';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // 가운데 표시(반사각 기준점을 학생이 알 수 있게)
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
    ctx.font = '700 24px ' + FONT;
    ctx.textBaseline = 'middle';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + String(this.score).padStart(4, '0'), 16, HUD_H / 2);

    ctx.fillStyle = '#ffd166';
    const hearts = this.lives > 0 ? '♥'.repeat(this.lives) : '없음';
    ctx.fillText('목숨 ' + hearts, 200, HUD_H / 2);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fe1ff';
    ctx.fillText('스테이지 ' + this.stage, W / 2 + 80, HUD_H / 2);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9d3ff';
    ctx.fillText('남은 벽돌 ' + this.remaining, W - 16, HUD_H / 2);
  }

  // 반투명 안내판
  _panel(y, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,8,18,0.85)';
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
      this._panel(H / 2 - 60, 120);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 34px ' + FONT;
      ctx.fillText('스페이스바를 눌러 시작', W / 2, H / 2 - 18);
      ctx.font = '600 21px ' + FONT;
      ctx.fillStyle = '#c9d3ff';
      ctx.fillText('← → (또는 A/D) 이동   ·   P 일시정지   ·   R 다시 시작', W / 2, H / 2 + 26);
      return;
    }

    if (this.state === 'paused') {
      this._panel(H / 2 - 55, 110);
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 40px ' + FONT;
      ctx.fillText('일시정지', W / 2, H / 2 - 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px ' + FONT;
      ctx.fillText('P키를 다시 누르면 계속합니다', W / 2, H / 2 + 28);
      return;
    }

    if (this.state === 'stageclear') {
      this._panel(H / 2 - 60, 120);
      ctx.fillStyle = '#7dffb0';
      ctx.font = '700 38px ' + FONT;
      ctx.fillText('스테이지 ' + this.stage + ' 클리어!', W / 2, H / 2 - 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 22px ' + FONT;
      ctx.fillText('다음 스테이지 준비 중… 공이 조금 빨라집니다', W / 2, H / 2 + 26);
      return;
    }

    if (this.state === 'over') {
      this._panel(H / 2 - 80, 160);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '700 52px ' + FONT;
      ctx.fillText('GAME OVER', W / 2, H / 2 - 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px ' + FONT;
      ctx.fillText('점수 ' + String(this.score).padStart(3, '0'), W / 2, H / 2 + 12);
      ctx.font = '600 24px ' + FONT;
      ctx.fillStyle = '#c9d3ff';
      ctx.fillText('R키를 눌러 다시 시작', W / 2, H / 2 + 52);
      return;
    }

    // 목숨을 잃은 직후 짧게 붉은 표시
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (0.35 * this.flash).toFixed(3) + ')';
      ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);
    }
  }
}
