# 공통 게임 인터페이스 계약 (v1)

모든 게임 모듈은 이 규격을 지킨다. 오케스트레이터가 이 계약으로 검증한다.

## 1. 모듈 형태
- 파일: `games/<이름>.js`, ES Module
- **default export = 게임 클래스 1개** (`export default class Shooter { ... }`)
- 외부 라이브러리·CDN·웹폰트·원격 이미지 **금지**. 순수 Canvas 2D + 인라인 코드만.

## 2. 필수 메서드
```js
export default class Game {
  constructor(canvas) { }  // 캔버스 보관, ctx 획득, 상태 초기화. 여기서 루프/리스너 시작 금지.
  start()  { }             // 루프 시작 + 키보드 리스너 등록. 중복 호출 안전해야 함.
  stop()   { }             // 루프 중지 + 리스너 전부 해제 + 타이머 정리. 중복 호출 안전해야 함.
}
```
- `stop()` 후 `start()` 재호출 시 **새 판이 정상 시작**되어야 한다(재시작 가능).
- 리스너는 `window.addEventListener('keydown', this._onKeyDown)`처럼 **바인딩된 참조를 필드에 저장**해서 `stop()`에서 정확히 제거한다. 익명 함수 등록 금지.
- 루프는 `requestAnimationFrame` 사용, id를 필드에 저장하고 `stop()`에서 `cancelAnimationFrame`.

## 3. 캔버스 규약
- 논리 해상도 **800 x 600 고정**. `constructor`에서 `canvas.width=800; canvas.height=600` 설정.
- 화면 크기 대응(반응형)은 **셸(index.html)의 CSS가 담당**. 게임은 좌표 스케일링을 신경 쓰지 않는다.
- 매 프레임 배경을 직접 칠한다(잔상 방지). 배경 기본색 `#0b0b12`.

## 4. 점수·게임오버 알림 (선택 콜백)
셸이 점수를 표시하므로 아래 훅을 지원한다. 없으면 무시되도록 옵셔널 호출.
```js
this.onScore    // (score:number) => void   점수 변할 때
this.onGameOver // (score:number) => void   게임 종료 시
// 호출: this.onScore?.(this.score)
```
- 게임 오버 시 게임은 **스스로 루프를 멈추지 않아도 되지만**, 화면에 "GAME OVER / R키로 재시작" 을 그린다.
- `R` 키로 내부 재시작 지원.

## 5. 조작 (학생 공통 규칙)
- 이동: **방향키** (게임별로 WASD 병행 허용)
- 액션/발사: **스페이스바**
- 일시정지: **P**
- 재시작: **R**
- `preventDefault()`로 방향키·스페이스 스크롤을 막는다.

## 6. 교실용 품질 기준
- 캔버스 내 텍스트 최소 20px, 점수/안내는 굵게. 뒷자리에서 읽혀야 한다.
- 색만으로 구분 금지(모양·위치·텍스트 병행). 배경 대비 확보.
- 소리는 넣지 않는다(수업 중 소음). 필요시 셸에서 일괄 제어.
- 난이도: 시작 30초는 초보도 버틸 수 있게. 점진적 상승.

## 7. 작업 경계 (충돌 방지)
| 담당 | 수정 가능 파일 |
|---|---|
| Worker 1 | `games/shooter.js` 만 |
| Worker 2 | `games/breakout.js` 만 |
| Worker 3 | `games/snake.js` 만 |
| Orchestrator | `index.html`, `games/INTERFACE.md`, 공용 파일 전부 |

워커는 할당된 파일 **1개 외에는 생성·수정 금지**(README, 테스트 파일 포함).

## 8. 실행 방식 주의
ES Module은 `file://` 더블클릭으로 열면 CORS 때문에 로드되지 않는다.
→ 오케스트레이터가 최종 통합 시 **index.html 하나에 전부 인라인한 배포본**을 함께 만든다.
개발 중 확인은 `python -m http.server` 로 한다.

## 9. 배경음악(BGM)
BGM 은 **셸이 소유한다.** 게임 모듈은 소리를 직접 내지 않는다.
- 엔진: `audio/chiptune.js` (Web Audio 로 합성. 외부 mp3·CDN 없음)
- 셸이 게임 시작 시 `music.play(게임id)`, 정리 시 `music.stop()` 을 호출한다.
- 곡을 추가·수정하려면 `audio/chiptune.js` 의 `TRACKS` 에 **게임 id 와 같은 이름**으로 넣는다.
- 워커는 `audio/` 를 수정하지 않는다(오케스트레이터 전용).
