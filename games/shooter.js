// 스페이스 인베이더 스타일 슈팅 게임
// 공통 인터페이스 계약(games/INTERFACE.md) v1 준수
// - default export 클래스 1개, constructor(canvas) / start() / stop()
// - 외부 라이브러리, CDN, 이미지, 소리 없음. 순수 Canvas 2D.

const W = 800;              // 논리 가로 해상도
const H = 600;              // 논리 세로 해상도
const BG = '#0b0b12';       // 배경색

// 적 격자: 8열 x 5행 (윗줄일수록 고득점)
const COLS = 8;
const ROWS = 5;
const CELL_W = 56;
const CELL_H = 42;
const E_W = 36;
const E_H = 24;
const GRID_TOP = 96;

// 적 종류: 색 + 모양을 둘 다 다르게 해서 색만으로 구분하지 않도록 함
const ENEMY_TYPES = [
  { kind: 'squid', color: '#ffe14d', score: 30 }, // 0행: 노랑 오징어형
  { kind: 'crab',  color: '#4dd2ff', score: 20 }, // 1행: 하늘색 게형
  { kind: 'crab',  color: '#4dd2ff', score: 20 }, // 2행
  { kind: 'ufo',   color: '#7cf06a', score: 10 }, // 3행: 초록 접시형
  { kind: 'ufo',   color: '#7cf06a', score: 10 }, // 4행
];

const PLAYER_Y = 538;
const PLAYER_W = 46;
const PLAYER_H = 22;
const PLAYER_SPEED = 330;   // px/초
const SHOT_COOLDOWN = 0.25; // 초 (누르고 있으면 자동 연사)
const MAX_PLAYER_BULLETS = 4;

const BARRIER_COUNT = 4;
const B_COLS = 7;
const B_ROWS = 4;
const B_BLOCK = 11;         // 방어벽 블록 한 칸 크기
const BARRIER_TOP = 452;

// 적이 반사되는 좌우 벽 여백
const WALL = 24;

/** 값을 min~max 사이로 자르기 */
function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

/** 두 사각형 충돌 판정 */
function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default class Shooter {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = canvas.getContext('2d');

    // 루프/리스너 상태 (생성자에서는 절대 시작하지 않음)
    this._raf = null;
    this._running = false;
    this._lastTime = 0;

    // 리스너는 반드시 바인딩된 참조를 필드에 저장 (stop에서 정확히 해제)
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._tick = this._tick.bind(this);

    this.keys = new Set();
    this.score = 0;

    // 옵셔널 훅 (셸이 필요하면 대입해서 사용)
    this.onScore = null;
    this.onGameOver = null;

    this._reset();
  }

  // ── 공개 API ──────────────────────────────────────────────

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

  // ── 상태 초기화 ───────────────────────────────────────────

  /** 새 판 시작 */
  _reset() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.paused = false;
    this.gameOver = false;
    this._overNotified = false;

    this.player = { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
    this.bullets = [];
    this.enemyBullets = [];
    this.shotTimer = 0;
    this.invuln = 0;          // 피격 후 무적 시간(초)
    this.animTimer = 0;       // 적 애니메이션용 누적 시간
    this.bannerTimer = 1.6;   // 시작 전 "준비!" 배너
    this.bannerText = '준비!';

    this._makeStars();
    this._makeBarriers();
    this._makeWave();
    this._emitScore();
  }

  /** 배경 별 (장식용, 판마다 새로 뿌림) */
  _makeStars() {
    this.stars = [];
    for (let i = 0; i < 46; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: Math.random() * (H - 120),
        r: Math.random() < 0.25 ? 2 : 1,
      });
    }
  }

  /** 방어벽 만들기 (블록별 내구도 2) */
  _makeBarriers() {
    this.barriers = [];
    const bw = B_COLS * B_BLOCK;
    const gap = (W - BARRIER_COUNT * bw) / (BARRIER_COUNT + 1);
    for (let i = 0; i < BARRIER_COUNT; i++) {
      const ox = gap + i * (bw + gap);
      const blocks = [];
      for (let r = 0; r < B_ROWS; r++) {
        for (let c = 0; c < B_COLS; c++) {
          // 아래 가운데를 비워 아치 모양으로
          if (r >= B_ROWS - 2 && c >= 2 && c <= B_COLS - 3) continue;
          blocks.push({
            x: ox + c * B_BLOCK,
            y: BARRIER_TOP + r * B_BLOCK,
            w: B_BLOCK,
            h: B_BLOCK,
            hp: 2,
          });
        }
      }
      this.barriers.push(blocks);
    }
  }

  /** 현재 웨이브의 적 격자 생성 */
  _makeWave() {
    const startX = (W - COLS * CELL_W) / 2 + (CELL_W - E_W) / 2;
    this.enemies = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = ENEMY_TYPES[r];
        this.enemies.push({
          x: startX + c * CELL_W,
          y: GRID_TOP + r * CELL_H,
          w: E_W,
          h: E_H,
          row: r,
          kind: t.kind,
          color: t.color,
          score: t.score,
          alive: true,
        });
      }
    }
    this.enemyTotal = this.enemies.length;
    this.dir = 1;
    // 웨이브가 오를수록 기본 속도 상승 (초반은 아주 느리게)
    this.baseSpeed = 26 + (this.wave - 1) * 9;
    this.dropStep = 16 + Math.min(8, this.wave);
    this.enemyBullets.length = 0;
    // 적 발사 간격: 웨이브가 오를수록 짧아짐
    this.fireBase = Math.max(0.45, 2.1 - (this.wave - 1) * 0.22);
    this.fireTimer = this.fireBase * 1.6; // 시작 직후엔 여유 있게
  }

  // ── 입력 ─────────────────────────────────────────────────

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

  // ── 메인 루프 ────────────────────────────────────────────

  _tick(now) {
    if (!this._running) return;
    if (!this._lastTime) this._lastTime = now;
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    if (dt > 0.05) dt = 0.05; // 탭 전환 등으로 인한 큰 점프 방지

    if (!this.paused && !this.gameOver) this._update(dt);
    this._draw();

    this._raf = requestAnimationFrame(this._tick);
  }

  _update(dt) {
    this.animTimer += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shotTimer > 0) this.shotTimer -= dt;

    this._updatePlayer(dt);
    this._updateBullets(dt);

    if (this.bannerTimer > 0) {
      // 배너 동안엔 적이 멈춰 있어 학생이 준비할 시간을 준다
      this.bannerTimer -= dt;
      return;
    }

    this._updateEnemies(dt);
    this._updateEnemyFire(dt);
    this._checkWaveClear();
  }

  _updatePlayer(dt) {
    let vx = 0;
    if (this._left()) vx -= 1;
    if (this._right()) vx += 1;
    this.player.x = clamp(
      this.player.x + vx * PLAYER_SPEED * dt,
      16,
      W - 16 - this.player.w
    );

    if (this._firing() && this.shotTimer <= 0 && this.bullets.length < MAX_PLAYER_BULLETS) {
      this.bullets.push({
        x: this.player.x + this.player.w / 2 - 2.5,
        y: this.player.y - 12,
        w: 5,
        h: 14,
      });
      this.shotTimer = SHOT_COOLDOWN;
    }
  }

  _updateBullets(dt) {
    // 플레이어 총알: 위로
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y -= 520 * dt;
      if (b.y + b.h < 0) { this.bullets.splice(i, 1); continue; }
      if (this._hitBarrier(b)) { this.bullets.splice(i, 1); continue; }
      let killed = false;
      for (const e of this.enemies) {
        if (!e.alive || !hit(b, e)) continue;
        e.alive = false;
        this.score += e.score;
        this._emitScore();
        killed = true;
        break;
      }
      if (killed) this.bullets.splice(i, 1);
    }

    // 적 총알: 아래로
    const evy = 165 + (this.wave - 1) * 18;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.y += evy * dt;
      if (b.y > H) { this.enemyBullets.splice(i, 1); continue; }
      if (this._hitBarrier(b)) { this.enemyBullets.splice(i, 1); continue; }
      if (this.invuln <= 0 && hit(b, this.player)) {
        this.enemyBullets.splice(i, 1);
        this._playerHit();
      }
    }
  }

  /** 방어벽 충돌 처리. 맞았으면 true */
  _hitBarrier(b) {
    for (const blocks of this.barriers) {
      for (let i = 0; i < blocks.length; i++) {
        if (hit(b, blocks[i])) {
          blocks[i].hp -= 1;
          if (blocks[i].hp <= 0) blocks.splice(i, 1);
          return true;
        }
      }
    }
    return false;
  }

  _updateEnemies(dt) {
    const alive = this.enemies.filter((e) => e.alive);
    if (alive.length === 0) return;

    // 남은 적이 적을수록 빨라진다 (고전 인베이더 느낌)
    const ratio = 1 - alive.length / this.enemyTotal;
    const speed = this.baseSpeed * (1 + ratio * 2.2);

    let minX = Infinity;
    let maxX = -Infinity;
    for (const e of alive) {
      e.x += this.dir * speed * dt;
      if (e.x < minX) minX = e.x;
      if (e.x + e.w > maxX) maxX = e.x + e.w;
    }

    // 벽에 닿으면 한 칸 내려오고 방향 전환 + 속도 소폭 증가
    if ((this.dir > 0 && maxX >= W - WALL) || (this.dir < 0 && minX <= WALL)) {
      this.dir *= -1;
      this.baseSpeed *= 1.05;
      for (const e of alive) {
        e.y += this.dropStep;
        e.x = clamp(e.x, WALL, W - WALL - e.w); // 벽에 박히지 않게 밀어넣기
      }
      for (const e of alive) {
        if (e.y + e.h >= this.player.y) {
          this._endGame();
          return;
        }
      }
    }
  }

  _updateEnemyFire(dt) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = this.fireBase * (0.6 + Math.random() * 0.9);

    // 각 열에서 가장 아래에 있는 적만 발사할 수 있다
    const shooters = new Map();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const key = Math.round(e.x / 4);
      const cur = shooters.get(key);
      if (!cur || e.y > cur.y) shooters.set(key, e);
    }
    const list = Array.from(shooters.values());
    if (list.length === 0) return;
    const s = list[Math.floor(Math.random() * list.length)];
    this.enemyBullets.push({ x: s.x + s.w / 2 - 3, y: s.y + s.h, w: 6, h: 16 });
  }

  _checkWaveClear() {
    if (this.enemies.some((e) => e.alive)) return;
    this.wave += 1;
    this.bullets.length = 0;
    this._makeWave();
    this.bannerText = '웨이브 ' + this.wave + ' 시작!';
    this.bannerTimer = 1.6;
  }

  _playerHit() {
    this.lives -= 1;
    this.invuln = 2.0;
    this.enemyBullets.length = 0;
    this.player.x = W / 2 - PLAYER_W / 2;
    if (this.lives <= 0) {
      this.lives = 0;
      this._endGame();
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

  // ── 그리기 ───────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    this._drawStars(ctx);
    this._drawHud(ctx);

    // 바닥선
    ctx.fillStyle = '#39406b';
    ctx.fillRect(0, H - 8, W, 3);

    for (const e of this.enemies) {
      if (e.alive) this._drawEnemy(ctx, e);
    }
    this._drawBarriers(ctx);
    this._drawPlayer(ctx);

    ctx.fillStyle = '#ffffff';
    for (const b of this.bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#ff8a5c';
    for (const b of this.enemyBullets) ctx.fillRect(b.x, b.y, b.w, b.h);

    if (this.gameOver) this._drawGameOver(ctx);
    else if (this.paused) this._drawPaused(ctx);
    else if (this.bannerTimer > 0) this._drawBanner(ctx);
  }

  _drawStars(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    for (const s of this.stars) ctx.fillRect(s.x, s.y, s.r, s.r);
  }

  _drawHud(ctx) {
    ctx.textBaseline = 'top';
    ctx.font = 'bold 24px system-ui, "Malgun Gothic", sans-serif';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + String(this.score).padStart(4, '0'), 20, 16);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('웨이브 ' + this.wave, W / 2, 16);

    // 목숨: 숫자 + 아이콘 병행 (색만으로 구분하지 않기)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('목숨 ' + this.lives, W - 20, 16);
    for (let i = 0; i < this.lives; i++) {
      this._shipShape(ctx, W - 42 - i * 30, 50, 24, 12, '#6cf0c2');
    }

    ctx.font = 'bold 20px system-ui, "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('← → 이동   스페이스 발사   P 일시정지   R 재시작', W / 2, H - 34);

    ctx.textBaseline = 'alphabetic';
  }

  /** 우주선 모양 (플레이어 + 목숨 아이콘 공용) */
  _shipShape(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);                 // 몸체
    ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.35); // 어깨
    ctx.fillRect(x + w * 0.44, y, w * 0.12, h * 0.35);          // 포신
  }

  _drawPlayer(ctx) {
    // 무적 시간 동안 깜빡임
    if (this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0) return;
    const p = this.player;
    this._shipShape(ctx, p.x, p.y, p.w, p.h, '#6cf0c2');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x + p.w * 0.46, p.y + 2, p.w * 0.08, 5);
  }

  _drawEnemy(ctx, e) {
    const step = Math.floor(this.animTimer * 3) % 2; // 다리 흔들림 2프레임
    const x = e.x;
    const y = e.y;
    const w = e.w;
    const h = e.h;
    ctx.fillStyle = e.color;

    if (e.kind === 'squid') {
      // 오징어형: 위가 뾰족한 마름모 + 촉수
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.55);
      ctx.lineTo(x + w * 0.75, y + h * 0.8);
      ctx.lineTo(x + w * 0.25, y + h * 0.8);
      ctx.lineTo(x, y + h * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x + w * 0.12, y + h * 0.8, w * 0.18, h * (step ? 0.2 : 0.12));
      ctx.fillRect(x + w * 0.7, y + h * 0.8, w * 0.18, h * (step ? 0.12 : 0.2));
    } else if (e.kind === 'crab') {
      // 게형: 네모 몸통 + 양쪽 집게
      ctx.fillRect(x + w * 0.18, y + h * 0.15, w * 0.64, h * 0.6);
      ctx.fillRect(x, y + h * 0.3, w * 0.16, h * 0.3);
      ctx.fillRect(x + w * 0.84, y + h * 0.3, w * 0.16, h * 0.3);
      ctx.fillRect(x + w * 0.24, y + h * 0.75, w * 0.14, h * (step ? 0.25 : 0.14));
      ctx.fillRect(x + w * 0.62, y + h * 0.75, w * 0.14, h * (step ? 0.14 : 0.25));
    } else {
      // 접시형: 납작한 타원 + 조종석
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.5, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.34, w * 0.24, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + w * (step ? 0.16 : 0.72), y + h * 0.82, w * 0.12, h * 0.16);
    }

    // 눈: 어두운 점 두 개 (모양 인식을 돕는 보조 표시)
    ctx.fillStyle = BG;
    ctx.fillRect(x + w * 0.3, y + h * 0.42, 3, 3);
    ctx.fillRect(x + w * 0.6, y + h * 0.42, 3, 3);
  }

  _drawBarriers(ctx) {
    for (const blocks of this.barriers) {
      for (const b of blocks) {
        // 내구도에 따라 색 + 크기를 함께 바꿔 색약 학생도 구분 가능
        if (b.hp >= 2) {
          ctx.fillStyle = '#9aa6ff';
          ctx.fillRect(b.x, b.y, b.w - 1, b.h - 1);
        } else {
          ctx.fillStyle = '#5a63b8';
          ctx.fillRect(b.x + 2, b.y + 2, b.w - 5, b.h - 5);
        }
      }
    }
  }

  _overlay(ctx, alpha) {
    ctx.fillStyle = 'rgba(5,5,12,' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  _drawBanner(ctx) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(this.bannerText, W / 2, H / 2 - 40);
    ctx.font = 'bold 22px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('스페이스바로 발사!', W / 2, H / 2);
  }

  _drawPaused(ctx) {
    this._overlay(ctx, 0.6);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('일시정지', W / 2, H / 2 - 10);
    ctx.font = 'bold 24px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('P키를 다시 누르면 계속합니다', W / 2, H / 2 + 40);
  }

  _drawGameOver(ctx) {
    this._overlay(ctx, 0.72);
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ff7a7a';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 46);
    ctx.font = 'bold 32px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('점수 ' + String(this.score).padStart(3, '0'), W / 2, H / 2 + 6);
    ctx.font = 'bold 24px system-ui, "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('R키를 눌러 다시 시작', W / 2, H / 2 + 52);
  }
}
