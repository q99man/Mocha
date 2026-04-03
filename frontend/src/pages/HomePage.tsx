import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="page">
      <section className="hero">
        <span className="hero__eyebrow">MVP 기본 구조</span>
        <h2>특정 장르에 묶이지 않는 짧고 직관적인 모션 챌린지를 준비했습니다.</h2>
        <p>
          현재 구조는 챌린지 탐색, 상세 확인, 도전 기록 흐름에 집중합니다. 카메라 세션과 점수 계산은 이후 단계에서
          무리한 구조 변경 없이 이어서 붙일 수 있습니다.
        </p>
        <div className="inline-actions">
          <Link className="button-link" to="/challenges">
            챌린지 둘러보기
          </Link>
          <Link className="button-link button-link--secondary" to="/attempts">
            도전 기록 보기
          </Link>
        </div>
      </section>

      <section className="panel">
        <h2>지금 바로 확인할 수 있는 기능</h2>
        <div className="stat-row">
          <div className="stat-card">
            <strong>챌린지 조회</strong>
            <p>목록과 상세 페이지가 명확한 타입 계약을 기준으로 연결되어 있습니다.</p>
          </div>
          <div className="stat-card">
            <strong>도전 기록</strong>
            <p>향후 백엔드 저장 구조를 염두에 둔 기록 화면 뼈대가 준비되어 있습니다.</p>
          </div>
          <div className="stat-card">
            <strong>모션 확장</strong>
            <p>카메라와 점수 계산 기능을 다음 단계에서 자연스럽게 추가할 수 있도록 비워 두었습니다.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
