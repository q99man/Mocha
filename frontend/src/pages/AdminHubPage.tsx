import { Link } from 'react-router-dom';

export function AdminHubPage() {
  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-entry-compact">
        <div className="board-detail-compact__toolbar mypage-compact-header">
          <div>
            <h2 className="board-classic-title">운영 허브 홈</h2>
            <p className="board-classic-summary">자산 관리, 챌린지 운영, 공개 화면 점검으로 빠르게 이동할 수 있습니다.</p>
          </div>
        </div>

        <div className="glass-chip-group mypage-compact-tabs admin-entry-compact__chips">
          <span className="glass-chip is-active">Compact Admin</span>
          <span className="glass-chip">운영 진입 허브</span>
          <span className="glass-chip">기존 톤 유지</span>
        </div>

        <div className="admin-entry-compact__grid">
          <Link className="admin-entry-compact__card" to="/admin/model-assets">
            <span>운영 관리</span>
            <strong>모델 · 챌린지 관리</strong>
            <p>포즈 모델 업로드, 챌린지 생성/수정, 레퍼런스 분석 실행까지 한 화면에서 이어집니다.</p>
          </Link>

          <Link className="admin-entry-compact__card" to="/admin/model-assets">
            <span>상태 점검</span>
            <strong>평가 준비 상태 확인</strong>
            <p>활성 모델, 분석 준비 완료 챌린지, 최근 운영 상태를 빠르게 훑고 바로 들어갈 수 있습니다.</p>
          </Link>

          <Link className="admin-entry-compact__card" to="/challenges">
            <span>공개 화면</span>
            <strong>사용자 경험 확인</strong>
            <p>운영자가 방금 바꾼 구성이 공개 챌린지 화면에서 어떻게 보이는지 바로 확인할 수 있습니다.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
