import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { getBoardPosts } from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { buildAuthModalHref } from '../shared/auth/authModalUtils';
import { Pagination } from '../shared/components/Pagination';
import { formatCompactDate as formatDate } from '../shared/presentation/dateTime';
import type { BoardCategory, BoardPostSummary } from '../shared/types/board';

const POSTS_PER_PAGE = 10;

const CATEGORY_OPTIONS: Array<{ value: 'ALL' | BoardCategory; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'NOTICE', label: '공지' },
  { value: 'FREE', label: '자유' },
  { value: 'QNA', label: '질문' },
];

export function BoardPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BoardPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? '');
  const [submittedKeyword, setSubmittedKeyword] = useState(() => searchParams.get('keyword') ?? '');
  const [category, setCategory] = useState<'ALL' | BoardCategory>(() => {
    const value = searchParams.get('category');
    return isBoardCategory(value) ? value : 'ALL';
  });
  const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get('page')));
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const nextKeyword = searchParams.get('keyword') ?? '';
    const nextCategory = searchParams.get('category');
    const nextPage = parsePage(searchParams.get('page'));

    setKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setSubmittedKeyword((current) => (current === nextKeyword ? current : nextKeyword));
    setCategory((current) => {
      const resolved = isBoardCategory(nextCategory) ? nextCategory : 'ALL';
      return current === resolved ? current : resolved;
    });
    setCurrentPage((current) => (current === nextPage ? current : nextPage));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('page');
    nextParams.delete('category');
    nextParams.delete('keyword');

    if (currentPage > 1) {
      nextParams.set('page', String(currentPage));
    }
    if (category !== 'ALL') {
      nextParams.set('category', category);
    }
    if (submittedKeyword.trim()) {
      nextParams.set('keyword', submittedKeyword.trim());
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [category, currentPage, searchParams, setSearchParams, submittedKeyword]);

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
          sourceType: 'GENERAL',
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
  }, [category, currentPage, submittedKeyword]);

  const totalPages = Math.max(1, Math.ceil(totalCount / POSTS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summaryText = useMemo(() => {
    if (loading) return '게시글을 불러오는 중입니다.';
    if (error) return '목록을 다시 불러오지 못했습니다.';
    if (submittedKeyword.trim()) return `검색 결과 ${totalCount}개`;
    return `전체 ${totalCount}개`;
  }, [error, loading, submittedKeyword, totalCount]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedKeyword(keyword.trim());
    setCurrentPage(1);
  }

  function handleCategoryChange(nextCategory: 'ALL' | BoardCategory) {
    setCategory(nextCategory);
    setCurrentPage(1);
  }

  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell">
        <div className="board-compact-toolbar">
          <div className="board-compact-filter-tabs">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`board-compact-tab${category === option.value ? ' is-active' : ''}`}
                onClick={() => handleCategoryChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form className="board-compact-search" onSubmit={handleSearchSubmit}>
            <span className="board-compact-summary">{summaryText}</span>
            <input
              className="board-compact-search__input"
              type="text"
              value={keyword}
              placeholder="제목 또는 내용 검색"
              onChange={(event) => setKeyword(event.target.value)}
            />
            <button className="button-link button-link--secondary button-link--compact" type="submit">
              검색
            </button>
            <Link
              className="button-link button-link--compact"
              to={isAuthenticated ? '/board/new' : buildAuthModalHref(location, { redirectPath: '/board/new' })}
            >
              {isAuthenticated ? '글쓰기' : '로그인'}
            </Link>
          </form>
        </div>

        <div className="board-compact-table">
          <div className="board-compact-head" role="presentation">
            <span className="board-compact-col board-compact-col--category">분류</span>
            <span className="board-compact-col board-compact-col--title">제목</span>
            <span className="board-compact-col board-compact-col--date">작성일</span>
            <span className="board-compact-col board-compact-col--author">작성자</span>
            <span className="board-compact-col board-compact-col--views">조회</span>
            <span className="board-compact-col board-compact-col--comments">댓글</span>
          </div>

          {loading ? (
            <div className="board-compact-empty">
              <strong>게시글을 불러오는 중입니다.</strong>
            </div>
          ) : error ? (
            <div className="board-compact-empty">
              <strong>게시글 목록을 불러오지 못했습니다.</strong>
              <p>{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="board-compact-empty">
              <strong>조건에 맞는 게시글이 없습니다.</strong>
              <p>검색어나 분류를 바꿔서 다시 확인해 주세요.</p>
            </div>
          ) : (
            <div className="board-compact-body">
              {posts.map((post) => (
                <article className="board-compact-row" key={post.id}>
                  <div className="board-compact-row__category">
                    <span className={`board-compact-badge${post.pinned ? ' is-pinned' : ''}`}>
                      {post.pinned ? '고정' : toCategoryLabel(post.category)}
                    </span>
                  </div>

                  <div className="board-compact-row__title">
                    <Link className="board-compact-row__title-link" to={`/board/${post.id}`}>
                      {post.title}
                    </Link>
                  </div>

                  <div className="board-compact-row__date">{formatDate(post.updatedAt)}</div>
                  <div className="board-compact-row__author">{post.authorDisplayName}</div>
                  <div className="board-compact-row__views">{post.viewCount}</div>
                  <div className="board-compact-row__comments">{post.commentCount}</div>
                </article>
              ))}
            </div>
          )}
        </div>

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </section>
    </div>
  );
}

function isBoardCategory(value: string | null): value is BoardCategory {
  return value === 'NOTICE' || value === 'FREE' || value === 'QNA';
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

