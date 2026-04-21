import type { KeyboardEvent } from 'react';

import type { Challenge } from '../../shared/types/challenge';

type FilterOption = {
  key: 'ALL' | 'NEW' | 'REVIEWED';
  label: string;
  count: number;
};

type ChallengeListPaneProps = {
  filterOptions: FilterOption[];
  activeFilter: FilterOption['key'];
  filteredChallenges: Challenge[];
  selectedId: number | null;
  onSelectFilter: (filter: FilterOption['key']) => void;
  registerItemRef: (challengeId: number, node: HTMLDivElement | null) => void;
  onItemClick: (challengeId: number) => void;
  onItemKeyDown: (event: KeyboardEvent<HTMLElement>, challengeId: number) => void;
  onItemFocus: (challengeId: number) => void;
  onItemDoubleClick: (challengeId: number) => void;
  onOpenReviews: (challengeId: number) => void;
  formatDuration: (durationSec: number) => string;
  formatDifficulty: (value: string) => string | number;
};

export function ChallengeListPane({
  filterOptions,
  activeFilter,
  filteredChallenges,
  selectedId,
  onSelectFilter,
  registerItemRef,
  onItemClick,
  onItemKeyDown,
  onItemFocus,
  onItemDoubleClick,
  onOpenReviews,
  formatDuration,
  formatDifficulty,
}: ChallengeListPaneProps) {
  return (
    <>
      <div className="song-select__filter-bar">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`song-select__filter-tab${activeFilter === option.key ? ' song-select__filter-tab--active' : ''}`}
            onClick={() => onSelectFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="song-select__list">
        {filteredChallenges.length === 0 ? (
          <div className="song-select__empty">
            <p>조건에 맞는 챌린지가 없습니다.</p>
          </div>
        ) : (
          filteredChallenges.map((challenge) => (
            <div
              key={challenge.id}
              ref={(node) => registerItemRef(challenge.id, node)}
              className={`song-select__item${selectedId === challenge.id ? ' song-select__item--active' : ''}`}
              role="button"
              tabIndex={selectedId === challenge.id ? 0 : -1}
              onClick={() => onItemClick(challenge.id)}
              onKeyDown={(event) => onItemKeyDown(event, challenge.id)}
              onFocus={() => onItemFocus(challenge.id)}
              onDoubleClick={() => onItemDoubleClick(challenge.id)}
            >
              <div className="song-select__item-thumb">
                <div className="song-select__item-difficulty">
                  <strong>{formatDifficulty(challenge.difficulty)}</strong>
                </div>
              </div>

              <div className="song-select__item-info">
                <span className="song-select__item-title">{challenge.title}</span>
                <span className="song-select__item-sub">
                  {challenge.category} · {formatDuration(challenge.durationSec)}
                </span>
              </div>

              <div className="song-select__item-actions">
                <button
                  type="button"
                  className="song-select__item-review-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenReviews(challenge.id);
                  }}
                >
                  후기
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
