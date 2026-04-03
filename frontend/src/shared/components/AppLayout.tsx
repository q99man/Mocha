import { NavLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <h1>모션 챌린지 플랫폼</h1>
          <p>장르에 제한 없이 다양한 동작 챌린지를 탐색하고 도전할 수 있는 웹 MVP입니다.</p>
        </div>
        <nav className="nav" aria-label="주요 메뉴">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/challenges">챌린지</NavLink>
          <NavLink to="/attempts">도전 기록</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
