import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { CompactFilterDropdown } from '../../shared/components/CompactFilterDropdown';
import { Pagination } from '../../shared/components/Pagination';
import type { Challenge } from '../../shared/types/challenge';

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type AdminChallengesSectionProps = {
  loading: boolean;
  filteredChallenges: Challenge[];
  pagedChallenges: Challenge[];
  categoryOptions: string[];
  challengeSearch: string;
  activeCategoryFilter: string;
  activeStatusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE';
  activeSort: 'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC';
  challengePage: number;
  challengeTotalPages: number;
  expandedChallengeId: number | null;
  activeAssetReady: boolean;
  analyzingId: number | null;
  deletingId: number | null;
  togglingId: number | null;
  challengeSummary: string;
  statusFilterOptions: FilterOption<'ALL' | 'ACTIVE' | 'INACTIVE'>[];
  sortOptions: FilterOption<'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC'>[];
  setChallengeSearch: (value: string) => void;
  onSelectCategoryFilter: (value: string) => void;
  onSelectStatusFilter: (value: 'ALL' | 'ACTIVE' | 'INACTIVE') => void;
  onSelectSort: (value: 'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC') => void;
  onResetFilters: () => void;
  onToggleChallengeRow: (challengeId: number) => void;
  onEditChallenge: (challenge: Challenge) => void;
  onToggleChallengeActive: (challenge: Challenge) => void | Promise<void>;
  onAnalyzeReference: (challengeId: number) => void | Promise<void>;
  onConfirmDeleteChallenge: (challenge: Challenge) => void;
  onChallengePageChange: (page: number) => void;
  formatDifficulty: (value: string) => string;
  formatReferenceStatus: (status: string) => string;
  formatDateTimeFull: (value: string) => string;
};

export function AdminChallengesSection({
  loading,
  filteredChallenges,
  pagedChallenges,
  categoryOptions,
  challengeSearch,
  activeCategoryFilter,
  activeStatusFilter,
  activeSort,
  challengePage,
  challengeTotalPages,
  expandedChallengeId,
  activeAssetReady,
  analyzingId,
  deletingId,
  togglingId,
  statusFilterOptions,
  sortOptions,
  setChallengeSearch,
  onSelectCategoryFilter,
  onSelectStatusFilter,
  onSelectSort,
  onResetFilters,
  onToggleChallengeRow,
  onEditChallenge,
  onToggleChallengeActive,
  onAnalyzeReference,
  onConfirmDeleteChallenge,
  onChallengePageChange,
  formatDifficulty,
  formatReferenceStatus,
  formatDateTimeFull,
}: AdminChallengesSectionProps) {
  return (
    <section className="admin-hub-compact__section admin-shell-compact__section">
      <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
        <div>
          <h3 className="glass-section-title">챌린지 관리</h3>
        </div>
      </div>

      <div className="admin-hub-compact__filters">
        <label className="mypage-inline-field admin-hub-compact__search-field">
          <span>검색</span>
          <div className="admin-hub-compact__search-input-wrap">
            <input
              type="text"
              value={challengeSearch}
              onChange={(event) => setChallengeSearch(event.target.value)}
              placeholder="제목, 설명, 카테고리, ID"
            />
            {challengeSearch || activeCategoryFilter !== 'ALL' || activeStatusFilter !== 'ALL' || activeSort !== 'NEWEST' ? (
              <button
                className="admin-hub-compact__search-clear"
                type="button"
                aria-label="필터 초기화"
                onClick={onResetFilters}
              >
                ×
              </button>
            ) : null}
          </div>
        </label>
        <CompactFilterDropdown
          className="mypage-inline-field admin-hub-compact__filter-select"
          label="카테고리"
          value={activeCategoryFilter}
          options={categoryOptions.map((category) => ({
            value: category,
            label: category === 'ALL' ? '전체' : category,
          }))}
          ariaLabel="카테고리 필터"
          onChange={onSelectCategoryFilter}
        />
        <CompactFilterDropdown
          className="mypage-inline-field admin-hub-compact__filter-select"
          label="상태"
          value={activeStatusFilter}
          options={statusFilterOptions}
          ariaLabel="상태 필터"
          onChange={onSelectStatusFilter}
        />
        <CompactFilterDropdown
          className="mypage-inline-field admin-hub-compact__filter-select"
          label="정렬"
          value={activeSort}
          options={sortOptions}
          ariaLabel="정렬 기준"
          onChange={onSelectSort}
        />
      </div>

      {loading ? (
        <div className="board-compact-empty">
          <strong>챌린지 목록을 불러오는 중입니다.</strong>
        </div>
      ) : pagedChallenges.length === 0 ? (
        <div className="board-compact-empty">
          <strong>조건에 맞는 챌린지가 없습니다.</strong>
        </div>
      ) : (
        <div className="admin-hub-compact-table">
          <div className="admin-hub-compact-table__head admin-hub-compact-table__head--challenges" role="presentation">
            <span>상태</span>
            <span>챌린지</span>
            <span>난이도</span>
            <span>분석</span>
            <span>상세</span>
          </div>

          <div className="admin-hub-compact-table__body">
            {pagedChallenges.map((challenge) => {
              const isExpanded = expandedChallengeId === challenge.id;

              return (
                <Fragment key={challenge.id}>
                  <article
                    className={`admin-hub-compact-row admin-hub-compact-row--challenges${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleChallengeRow(challenge.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleChallengeRow(challenge.id);
                      }
                    }}
                  >
                    <div className="admin-hub-compact-row__status admin-hub-compact-row__status--stack">
                      <span className={`board-classic-badge${challenge.isActive ? ' is-pinned' : ''}`}>
                        {challenge.isActive ? '활성' : '비활성'}
                      </span>
                      <span className={`board-classic-badge${challenge.referenceMotionProfileReady ? ' is-pinned' : ''}`}>
                        {challenge.referenceMotionProfileReady ? '평가 가능' : '분석 필요'}
                      </span>
                    </div>
                    <div className="admin-hub-compact-row__title">
                      <strong>{challenge.title}</strong>
                      <span>
                        #{challenge.id} · {challenge.category}
                      </span>
                    </div>
                    <div className="admin-hub-compact-row__metric">{formatDifficulty(challenge.difficulty)}</div>
                    <div className="admin-hub-compact-row__meta">{formatReferenceStatus(challenge.referenceAnalysisStatus)}</div>
                    <div className="admin-hub-compact-row__actions">
                      <button
                        className="button-link button-link--secondary admin-hub-compact__action-btn"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleChallengeRow(challenge.id);
                        }}
                      >
                        {isExpanded ? '닫기' : '상세'}
                      </button>
                    </div>
                  </article>

                  {isExpanded ? (
                    <section className="admin-hub-compact__inline-detail">
                      <div className="admin-hub-compact__inline-header">
                        <div>
                          <strong>{challenge.title}</strong>
                          <p>{challenge.description}</p>
                        </div>
                        <div className="admin-hub-compact-row__actions admin-hub-compact-row__actions--wrap">
                          <Link
                            className="button-link button-link--secondary admin-hub-compact__action-btn"
                            to={`/admin/challenges/${challenge.id}/analysis`}
                          >
                            분석 보기
                          </Link>
                          <button
                            className="button-link button-link--secondary admin-hub-compact__action-btn"
                            type="button"
                            disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                            onClick={() => onEditChallenge(challenge)}
                          >
                            수정
                          </button>
                          <button
                            className="button-link button-link--secondary admin-hub-compact__action-btn"
                            type="button"
                            disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                            onClick={() => void onToggleChallengeActive(challenge)}
                          >
                            {togglingId === challenge.id ? '변경 중...' : challenge.isActive ? '비활성' : '활성'}
                          </button>
                          <button
                            className="button-link admin-hub-compact__action-btn"
                            type="button"
                            disabled={
                              !activeAssetReady ||
                              !challenge.referenceVideoUploaded ||
                              !challenge.isActive ||
                              analyzingId === challenge.id ||
                              deletingId === challenge.id ||
                              togglingId === challenge.id
                            }
                            onClick={() => void onAnalyzeReference(challenge.id)}
                          >
                            {analyzingId === challenge.id ? '분석 중...' : '분석 실행'}
                          </button>
                          <button
                            className="button-link button-link--secondary admin-hub-compact__action-btn admin-hub-compact__action-btn--danger"
                            type="button"
                            disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                            onClick={() => onConfirmDeleteChallenge(challenge)}
                          >
                            {deletingId === challenge.id ? '삭제 중...' : '삭제'}
                          </button>
                        </div>
                      </div>

                      <div className="admin-hub-compact__inline-meta">
                        <span>카테고리 {challenge.category}</span>
                        <span>난이도 {formatDifficulty(challenge.difficulty)}</span>
                        <span>길이 {challenge.durationSec}초</span>
                        <span>레퍼런스 영상 {challenge.referenceVideoUploaded ? '등록됨' : '없음'}</span>
                        <span>분석 {formatReferenceStatus(challenge.referenceAnalysisStatus)}</span>
                        <span>평가 {challenge.referenceMotionProfileReady && challenge.isActive ? '가능' : '준비 중'}</span>
                        <span>가이드 영상 {challenge.guideVideoUrl ? '연결됨' : '없음'}</span>
                      </div>

                      <div className="admin-hub-compact__inline-grid">
                        <div className="admin-hub-compact__inline-card">
                          <span>레퍼런스 파일</span>
                          <strong>{challenge.referenceVideoOriginalFileName ?? '등록된 파일이 없습니다.'}</strong>
                        </div>
                        <div className="admin-hub-compact__inline-card">
                          <span>최근 분석 시각</span>
                          <strong>
                            {challenge.referenceAnalyzedAt
                              ? formatDateTimeFull(challenge.referenceAnalyzedAt)
                              : '아직 분석되지 않았습니다.'}
                          </strong>
                        </div>
                        <div className="admin-hub-compact__inline-card">
                          <span>가이드 영상 URL</span>
                          <strong>{challenge.guideVideoUrl ?? '연결된 URL이 없습니다.'}</strong>
                        </div>
                        <div className="admin-hub-compact__inline-card">
                          <span>썸네일 URL</span>
                          <strong>{challenge.thumbnailUrl ?? '연결된 URL이 없습니다.'}</strong>
                        </div>
                      </div>

                      {challenge.latestRetrySummary ? (
                        <div className="admin-hub-compact__inline-grid admin-hub-compact__inline-grid--stats">
                          <div className="admin-hub-compact__inline-card">
                            <span>최근 점수</span>
                            <strong>{challenge.latestRetrySummary.latestScore}점</strong>
                          </div>
                          <div className="admin-hub-compact__inline-card">
                            <span>최근 도전</span>
                            <strong>{formatDateTimeFull(challenge.latestRetrySummary.latestAttemptedAt)}</strong>
                          </div>
                          <div className="admin-hub-compact__inline-card">
                            <span>강점</span>
                            <strong>{challenge.latestRetrySummary.strongestArea ?? '데이터 없음'}</strong>
                          </div>
                          <div className="admin-hub-compact__inline-card">
                            <span>보완</span>
                            <strong>{challenge.latestRetrySummary.weakestArea ?? '데이터 없음'}</strong>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Pagination currentPage={challengePage} totalPages={challengeTotalPages} onPageChange={onChallengePageChange} />
    </section>
  );
}
