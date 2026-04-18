import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getBoardPosts } from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { Pagination } from '../shared/components/Pagination';
import type { BoardCategory, BoardPostSummary } from '../shared/types/board';

const POSTS_PER_PAGE = 20;

const CATEGORY_OPTIONS: Array<{ value: 'ALL' | BoardCategory; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'NOTICE', label: '공지' },
  { value: 'FREE', label: '자유' },
  { value: 'QNA', label: '질문' },
];

export function BoardPage() {
  const { isAuthenticated } = useAuth();
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
    const nextParams = new URLSearchParams();

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
    if (error) return '연결 상태를 확인한 뒤 다시 시도해 주세요.';
    return `총 ${totalCount}개의 게시글`;
  }, [error, loading, totalCount]);

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
    <div className="glass-page">
      <section className="glass-panel board-classic-shell">
        <div className="board-classic-topbar">
          <div>
            <h2 className="board-classic-title">게시판</h2>
            <p className="board-classic-summary">{summaryText}</p>
          </div>

          <div className="inline-actions">
            <Link className="button-link" to={isAuthenticated ? '/board/new' : '/auth'}>
              {isAuthenticated ? '글쓰기' : '로그인 후 글쓰기'}
            </Link>
          </div>
        </div>

        <form className="board-classic-filters" onSubmit={handleSearchSubmit}>
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

          <label className="glass-select board-classic-filters__search">
            <span>검색</span>
            <input
              type="text"
              value={keyword}
              placeholder="제목 또는 내용을 검색해 보세요"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>

          <div className="inline-actions">
            <button className="button-link button-link--secondary" type="submit">
              검색
            </button>
          </div>
        </form>

        <div className="board-classic-table">
          <div className="board-classic-table__head" role="presentation">
            <span>분류</span>
            <span>제목</span>
            <span>작성자</span>
            <span>작성일</span>
            <span>조회</span>
            <span>댓글</span>
          </div>

          {loading ? (
            <div className="glass-panel glass-panel--nested glass-panel--empty">
              <strong>게시글을 불러오는 중입니다.</strong>
            </div>
          ) : posts.length === 0 ? (
            <div className="glass-panel glass-panel--nested glass-panel--empty">
              <strong>조건에 맞는 게시글이 없습니다.</strong>
              <p>검색어를 바꾸거나 새 게시글을 작성해 보세요.</p>
            </div>
          ) : (
            <div className="board-classic-table__body">
              {posts.map((post) => (
                <article className="board-classic-row" key={post.id}>
                  <div className="board-classic-row__category">
                    <span className={`board-classic-badge${post.pinned ? ' is-pinned' : ''}`}>
                      {post.pinned ? '고정' : toCategoryLabel(post.category)}
                    </span>
                  </div>

                  <div className="board-classic-row__title">
                    <Link className="board-classic-row__title-link" to={`/board/${post.id}`}>
                      {post.title}
                    </Link>
                    {post.pinned ? <span className="board-classic-row__pin">공지 상단 고정</span> : null}
                  </div>

                  <div className="board-classic-row__author">{post.authorDisplayName}</div>
                  <div className="board-classic-row__date">{formatDate(post.updatedAt)}</div>
                  <div className="board-classic-row__metric board-classic-row__metric--views">{post.viewCount}</div>
                  <div className="board-classic-row__metric board-classic-row__metric--comments">{post.commentCount}</div>
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

function formatDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}
