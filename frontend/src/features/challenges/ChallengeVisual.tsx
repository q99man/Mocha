import { resolveApiUrl } from '../../shared/api/client';

type ChallengeVisualProps = {
  title: string;
  thumbnailUrl: string | null;
  fallbackThumbnailVideoUrl: string | null;
  className: string;
  placeholderClassName: string;
  videoAutoPlay?: boolean;
};

export function ChallengeVisual({
  title,
  thumbnailUrl,
  fallbackThumbnailVideoUrl,
  className,
  placeholderClassName,
  videoAutoPlay = false,
}: ChallengeVisualProps) {
  if (thumbnailUrl) {
    return <img className={className} src={thumbnailUrl} alt={title} />;
  }

  if (fallbackThumbnailVideoUrl) {
    return (
      <video
        className={className}
        src={resolveApiUrl(fallbackThumbnailVideoUrl)}
        aria-label={title}
        autoPlay={videoAutoPlay}
        loop={videoAutoPlay}
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <div className={placeholderClassName}>VISUAL READY SOON</div>;
}
