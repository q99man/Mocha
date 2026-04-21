import { ChallengeVisual } from './ChallengeVisual';
import type { Challenge } from '../../shared/types/challenge';

type ChallengeDetailHeroProps = {
  selectedChallenge: Challenge | null;
  resolvedPreviewUrl: string | null;
  onOpenModal: (challengeId: number) => void;
};

export function ChallengeDetailHero({ selectedChallenge, resolvedPreviewUrl, onOpenModal }: ChallengeDetailHeroProps) {
  return (
    <div className="song-select__detail song-select__detail--video-fill">
      {selectedChallenge && resolvedPreviewUrl ? (
        <video
          key={selectedChallenge.id}
          className="song-select__bg-video"
          src={resolvedPreviewUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : selectedChallenge ? (
        <div className="song-select__bg-video-placeholder">
          <ChallengeVisual
            title={selectedChallenge.title}
            thumbnailUrl={selectedChallenge.thumbnailUrl}
            fallbackThumbnailVideoUrl={selectedChallenge.fallbackThumbnailVideoUrl}
            className=""
            placeholderClassName=""
          />
        </div>
      ) : null}

      <div className="song-select__detail-gradient" />

      {selectedChallenge ? (
        <div className="song-select__detail-overlay">
          <div className="song-select__detail-content">
            <h2 className="song-select__title song-select__title--overlay">{selectedChallenge.title}</h2>
          </div>

          <div className="song-select__actions">
            <button type="button" className="song-select__action-btn" onClick={() => onOpenModal(selectedChallenge.id)}>
              도전 시작
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
