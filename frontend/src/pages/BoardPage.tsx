import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ReviewStars } from '../features/reviews/ReviewStars';
import { getBoardOverview, getBoardPosts } from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { Pagination } from '../shared/components/Pagination';
import type {
  BoardCategory,
  BoardOverview,
  BoardPostSourceType,
  BoardPostSummary,
} from '../shared/types/board';

const POSTS_PER_PAGE = 10;

const CATEGORY_OPTIONS: Array<{ value: 'ALL' | BoardCategory; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'NOTICE', label: '공지' },
  { value: 'FREE', label: '자유' },
  { value: 'QNA', label: '질문' },
  { value: 'REVIEW', label: '후기' },
];

const SOURCE_FILTERS: Array<{ value: 'ALL' | BoardPostSourceType; label: string; description: string }> = [
  { value: 'ALL', label: '전체 흐름', description: '게시글과 후기를 함께 봅니다.' },
  { value: 'GENERAL', label: '일반 글', description: '자유글, 질문, 공지만 모아 봅니다.' },
  { value: 'REVIEW_SYNC', label: '자동 후기', description: '챌린지 후기만 모아 봅니다.' },
];

export function BoardPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<BoardOverview | null>(null);
  const [posts, setPosts] = useState<BoardPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? '');
  const [submittedKeyword, setSubmittedKeyword] = useState(() => searchParams.get('keyword') ?? '');
  const [category, setCategory] = useState<'ALL' | BoardCategory>(() => {
    const value = searchParams.get('category');
    return isBoardCategory(value) ? value : 'ALL';
  });
  const [sourceType, setSourceType] = useState<'ALL' | BoardPostSourceType>(() => {
    const value = searchParams.get('sourceType');
    return isBoardSourceType(value) ? value : 'ALL';
  });
  const [challengeId, setChallengeId] = useState<number | null>(() => parseChallengeId(searchParams.get('challengeId')));
  const [challengeTitle, setChallengeTitle] = useState(() => searchParams.get('challengeTitle') ?? '');
  const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get('page')));
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const response = await getBoardOverview();
        if (active) {
          setOverview(response);
        }
      } catch {
        if (active) {
          setOverview(null);
        }
      }
    }

    void loadOverview();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') ?? '';
    const nextCategory = searchParams.get('category');
    const nextSourceType = searchParams.get('sourceType');
    const nextChallengeId = parseChallengeId(searchParams.get('challengeId'));
    const nextChallengeTitle = searchParams.get('challengeTitle') ?? '';
    const nextPage = parsePage(searchParams.get('page'));

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSubmittedKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setCategory((current) => {
      const resolved = isBoardCategory(nextCategory) ? nextCategory : 'ALL';
      return current === resolved ? current : resolved;
    });
    setSourceType((current) => {
      const resolved = isBoardSourceType(nextSourceType) ? nextSourceType : 'ALL';
      return current === resolved ? current : resolved;
    });
    setChallengeId((current) => (current === nextChallengeId ? current : nextChallengeId));
    setChallengeTitle((current) => (current === nextChallengeTitle ? current : nextChallengeTitle));
    setCurrentPage((current) => (current === nextPage ? current : nextPage));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (currentPage > 1) {
      nextParams.set('page', String(currentPage));
    }
    if (category !== 'ALL') {
      nextParams.set('category', category);
    }
    if (sourceType !== 'ALL') {
      nextParams.set('sourceType', sourceType);
    }
    if (challengeId != null) {
      nextParams.set('challengeId', String(challengeId));
    }
    if (challengeTitle.trim()) {
      nextParams.set('challengeTitle', challengeTitle.trim());
    }
    if (submittedKeyword.trim()) {
      nextParams.set('keyword', submittedKeyword.trim());
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [category, challengeId, challengeTitle, currentPage, searchParams, setSearchParams, sourceType, submittedKeyword]);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      setLoading(true);
      setError(null);

      try {
        const response = await getBoardPosts({
          page: currentPage,
          size: POSTS_PER_PAGE,
          category,
          sourceType,
          challengeId,
          keyword: submittedKeyword,
        });

        if (!active) {
          return;
        }

        setPosts(response.items);
        setTotalCount(response.totalCount);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setPosts([]);
        setTotalCount(0);
        setError(loadError instanceof Error ? loadError.message : '게시글 목록을 불러오지 못했습니다.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPosts();
    return () => {
      active = false;
    };
  }, [category, challengeId, currentPage, sourceType, submittedKeyword]);

  const totalPages = Math.max(1, Math.ceil(totalCount / POSTS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeSourceLabel = SOURCE_FILTERS.find((item) => item.value === sourceType)?.label ?? '전체 흐름';

  const summaryText = useMemo(() => {
    if (loading) return '게시글을 불러오는 중입니다.';
    if (error) return '연결 상태를 확인한 뒤 다시 시도해 주세요.';

    const challengeText =
      challengeId != null
        ? `${challengeTitle.trim() || `챌린지 #${challengeId}`} 기준으로 `
        : '';

    return `${challengeText}${activeSourceLabel}에서 ${totalCount}개의 게시글을 찾았습니다.`;
  }, [activeSourceLabel, challengeId, challengeTitle, error, loading, totalCount]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedKeyword(keyword.trim());
    setCurrentPage(1);
  }

  function handleSourceFilter(nextSourceType: 'ALL' | BoardPostSourceType) {
    setSourceType(nextSourceType);
    setCurrentPage(1);
  }

  function handleCategoryChange(nextCategory: 'ALL' | BoardCategory) {
    setCategory(nextCategory);
    setCurrentPage(1);
  }

  function applyChallengeReviewFilter(nextChallengeId: number, nextChallengeTitle: string) {
    setSourceType('REVIEW_SYNC');
    setCategory('ALL');
    setChallengeId(nextChallengeId);
    setChallengeTitle(nextChallengeTitle);
    setKeyword('');
    setSubmittedKeyword('');
    setCurrentPage(1);
  }

  function clearChallengeFilter() {
    setChallengeId(null);
    setChallengeTitle('');
    setCurrentPage(1);
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">Community</span>
          <h2>사용자 게시판</h2>
          <p>일반 게시글과 챌린지 후기를 같은 흐름에서 보되, 필요한 순간에는 특정 챌린지 후기만 바로 모아볼 수 있게 정리했습니다.</p>
        </div>
        <div className="glass-intro__meta">
          <div>
            <span>전체</span>
            <strong>{String(overview?.totalCount ?? totalCount).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>일반 글</span>
            <strong>{String(overview?.generalCount ?? 0).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>자동 후기</span>
            <strong>{String(overview?.reviewCount ?? 0).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      {overview?.topReviewChallenges.length ? (
        <section className="glass-panel">
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">후기 집중 챌린지</h3>
              <p className="glass-toolbar__note">후기가 많이 쌓인 챌린지는 바로 리뷰 모드로 전환해 비교할 수 있게 연결했습니다.</p>
            </div>
          </div>

          <div className="board-highlight-grid">
            {overview.topReviewChallenges.map((challenge) => (
              <article className="glass-panel glass-panel--nested board-highlight-card" key={challenge.challengeId}>
                <span className="glass-list-item__eyebrow">챌린지 후기</span>
                <strong>{challenge.challengeTitle}</strong>
                <ReviewStars value={Number(challenge.averageRating.toFixed(0))} />
                <div className="glass-inline-meta">
                  <span>후기 {challenge.reviewCount}개</span>
                  <span>평균 {challenge.averageRating.toFixed(1)}점</span>
                </div>
                <div className="inline-actions">
                  <Link className="button-link button-link--secondary" to={`/challenges/${challenge.challengeId}`}>
                    챌린지 보기
                  </Link>
                  <button
                    className="button-link"
                    type="button"
                    onClick={() => applyChallengeReviewFilter(challenge.challengeId, challenge.challengeTitle)}
                  >
                    후기 모아보기
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="glass-panel">
        <div className="glass-toolbar glass-toolbar--stack">
          <div className="glass-chip-group">
            {SOURCE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={`glass-chip${sourceType === filter.value ? ' is-active' : ''}`}
                type="button"
                onClick={() => handleSourceFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <p className="glass-toolbar__note">
            {SOURCE_FILTERS.find((item) => item.value === sourceType)?.description ?? '게시글과 후기를 함께 봅니다.'}
          </p>

          {challengeId != null ? (
            <div className="glass-inline-meta">
              <span>{challengeTitle.trim() || `챌린지 #${challengeId}`}</span>
              <span>챌린지 후기 필터 적용 중</span>
              <button className="glass-chip" type="button" onClick={clearChallengeFilter}>
                필터 해제
              </button>
            </div>
          ) : null}

          <form className="glass-toolbar__row" onSubmit={handleSearchSubmit}>
            <label className="glass-select">
              <span>카테고리</span>
              <select value={category} onChange={(event) => handleCategoryChange(event.target.value as 'ALL' | BoardCategory)}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="glass-select">
              <span>검색</span>
              <input
                type="text"
                value={keyword}
                placeholder="제목, 내용, 챌린지명을 검색해 보세요."
                onChange={(event) => setKeyword(event.target.value)}
              />
            </label>

            <div className="inline-actions">
              <button className="button-link button-link--secondary" type="submit">
                검색
              </button>
              <Link className="button-link" to={isAuthenticated ? '/board/new' : '/auth'}>
                {isAuthenticated ? '글 작성' : '로그인 후 작성'}
              </Link>
            </div>
          </form>

          <p className="glass-toolbar__note">{summaryText}</p>
        </div>

        {loading ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>게시글을 불러오는 중입니다.</strong>
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>조건에 맞는 게시글이 없습니다.</strong>
            <p>필터를 바꾸거나 새로운 게시글 또는 챌린지 후기를 등록해 보세요.</p>
          </div>
        ) : (
          <div className="glass-list">
            {posts.map((post) => {
              const isReviewSync = post.sourceType === 'REVIEW_SYNC';

              return (
                <article
                  className={`glass-list-item glass-list-item--interactive${isReviewSync ? ' board-review-card' : ''}`}
                  key={post.id}
                >
                  <div className="glass-list-item__content">
                    <div className="glass-list-item__header">
                      <div>
                        <span className="glass-list-item__eyebrow">
                          {toCategoryLabel(post.category)}
                          {post.pinned ? ' · 고정' : ''}
                          {isReviewSync ? ' · 챌린지 후기' : ''}
                        </span>
                        <strong>
                          <Link className="board-list-item__title" to={`/board/${post.id}`}>
                            {post.title}
                          </Link>
                        </strong>
                      </div>
                      <span className={`glass-badge${post.pinned ? ' is-accent' : ''}`}>
                        {isReviewSync ? '자동 후기' : post.pinned ? '고정' : '게시글'}
                      </span>
                    </div>

                    {isReviewSync ? (
                      <div className="board-review-inline">
                        {post.reviewRating ? <ReviewStars value={post.reviewRating} /> : null}
                        {post.challengeId && post.challengeTitle ? (
                          <>
                            <Link className="board-review-inline__link" to={`/challenges/${post.challengeId}`}>
                              {post.challengeTitle}
                            </Link>
                            <button
                              className="glass-chip"
                              type="button"
                              onClick={() => applyChallengeReviewFilter(post.challengeId!, post.challengeTitle!)}
                            >
                              같은 챌린지 후기
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="glass-list-item__description">{post.excerpt}</p>

                    <div className="glass-inline-meta">
                      <span>{post.authorDisplayName}</span>
                      <span>{formatDate(post.updatedAt)}</span>
                      <span>조회 {post.viewCount}</span>
                      <span>댓글 {post.commentCount}</span>
                    </div>
                  </div>

                  <div className="glass-list-item__actions">
                    <Link className="button-link button-link--secondary" to={`/board/${post.id}`}>
                      상세 보기
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}

function isBoardCategory(value: string | null): value is BoardCategory {
  return value === 'NOTICE' || value === 'FREE' || value === 'QNA' || value === 'REVIEW';
}

function isBoardSourceType(value: string | null): value is BoardPostSourceType {
  return value === 'GENERAL' || value === 'REVIEW_SYNC';
}

function parseChallengeId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePage(value: string | null) {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function toCategoryLabel(category: BoardCategory) {
  switch (category) {
    case 'NOTICE':
      return '공지';
    case 'FREE':
      return '자유';
    case 'QNA':
      return '질문';
    case 'REVIEW':
      return '후기';
    default:
      return category;
  }
}

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
  });
}
