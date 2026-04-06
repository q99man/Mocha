import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="page">
      <section className="hero hero--stage">
        <div className="hero__content">
          <span className="hero__eyebrow">STAGE ENTRY / WEB MVP</span>
          <h2>움직임을 선택하고, 준비 상태를 점검하고, 결과를 무대처럼 확인하는 모션 챌린지 콘솔</h2>
          <p>
            Mocha는 짧은 동작 챌린지를 탐색하고, 실제 업로드 기반 자동 채점 흐름과 프로토타입 결과 화면을 한 번에 확인할 수 있는 데모형 웹 서비스입니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">
              챌린지 선택하기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 아카이브 보기
            </Link>
          </div>
        </div>

        <div className="hero__aside hero__aside--stage">
          <div className="signal-panel panel-lift panel-lift--accent">
            <span className="signal-panel__label">SYSTEM STATUS</span>
            <strong>CHALLENGE FLOW READY</strong>
            <p>목록, 상세, 시작, 업로드, 결과, 기록 화면이 하나의 흐름으로 연결되어 있습니다.</p>
          </div>
          <div className="signal-grid">
            <div className="signal-grid__item panel-lift">
              <span>FLOW</span>
              <strong>05</strong>
              <p>홈 / 목록 / 상세 / 시작 / 결과</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>MODE</span>
              <strong>LIVE</strong>
              <p>실제 API 계약 기준 연결</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>SCORE</span>
              <strong>MOCK</strong>
              <p>자동 채점 데모 가능</p>
            </div>
            <div className="signal-grid__item panel-lift">
              <span>STATE</span>
              <strong>ARCHIVE</strong>
              <p>시도 기록 즉시 확인</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel panel--section panel-lift">
        <div className="section-heading">
          <span className="section-heading__code">01</span>
          <div>
            <h2>지금 들어와 있는 모드</h2>
            <p>현재 MVP는 챌린지 탐색과 사전 흐름 확인에 초점을 맞추고 있습니다.</p>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card stat-card--accent panel-lift panel-lift--accent">
            <strong>챌린지 탐색</strong>
            <p>목록과 상세 화면에서 난이도, 진행 시간, 레퍼런스 분석 준비 상태를 빠르게 확인할 수 있습니다.</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>사전 준비</strong>
            <p>카메라 권한 확인과 업로드 기반 자동 채점 흐름을 같은 시작 화면에서 점검할 수 있습니다.</p>
          </div>
          <div className="stat-card panel-lift">
            <strong>결과 아카이브</strong>
            <p>준비 기록과 완료 결과가 같은 결과 구조를 공유해 이후 확장 방향도 분명합니다.</p>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>현재 추천 진입 순서</h2>
              <p>DJMAX풍 선택 UI를 Mocha 흐름에 맞게 단계적으로 옮기기 위한 기본 루트입니다.</p>
            </div>
          </div>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 챌린지 선택 화면에서 메타 정보 확인</div>
            <div className="detail-flow__item">2. 상세 화면에서 준비 상태와 가이드 확인</div>
            <div className="detail-flow__item">3. 시작 화면에서 카메라 또는 업로드 흐름 진입</div>
            <div className="detail-flow__item">4. 결과 화면에서 점수와 헤드라인 확인</div>
          </div>
        </article>

        <article className="panel panel--section panel-lift">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>다음 리디자인 방향</h2>
              <p>지금부터는 카드형 UI보다 선택형 리듬 게임 HUD에 더 가까운 질감으로 밀어갑니다.</p>
            </div>
          </div>
          <ul className="detail-list">
            <li>
              <strong>시각 톤</strong>
              네온 스테이지 배경, 유리 패널, 글로우 중심 톤으로 계속 정리합니다.
            </li>
            <li>
              <strong>정보 위계</strong>
              점수, 상태, 진행 시간처럼 빠르게 읽히는 메트릭을 우선 배치합니다.
            </li>
            <li>
              <strong>흐름 구조</strong>
              선택, 준비, 결과가 하나의 콘솔 경험처럼 이어지도록 통일합니다.
            </li>
          </ul>
        </article>
      </section>
    </div>
  );
}
