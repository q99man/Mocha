import { NavLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="shell">
      <div className="shell__backdrop shell__backdrop--one" aria-hidden="true" />
      <div className="shell__backdrop shell__backdrop--two" aria-hidden="true" />
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__brand-code">MOCHA / MOTION SIGNAL</span>
          <h1>모카 스테이지</h1>
          <p>장르를 가리지 않는 모션 챌린지를 탐색하고, 준비 상태와 결과를 퍼포먼스 콘솔처럼 확인하는 웹 MVP입니다.</p>
        </div>
        <nav className="nav" aria-label="주요 메뉴">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/challenges">챌린지</NavLink>
          <NavLink to="/attempts">도전 기록</NavLink>
          <NavLink to="/admin/model-assets">운영</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
