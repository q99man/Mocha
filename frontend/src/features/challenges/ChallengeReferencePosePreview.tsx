import { useEffect, useRef, useState } from 'react';
import { getChallengeReferencePreview } from '../../shared/api/challengeApi';
import { resolveApiUrl } from '../../shared/api/client';
import type { ChallengeReferencePoseFrame, ChallengeReferencePosePoint, ChallengeReferencePosePreview } from '../../shared/types/challenge';

type Props = {
  challengeId: number;
  challengeTitle: string;
  enabled: boolean;
};

type FrameTile = {
  frame: ChallengeReferencePoseFrame;
  label: string;
};

type PosePart = 'all' | 'head' | 'torso' | 'arms' | 'legs';
type RenderPart = Exclude<PosePart, 'all'>;

type Segment = {
  start: string;
  end: string;
  part: RenderPart;
};

type PartLegend = {
  id: PosePart;
  label: string;
  color: string;
};

const TEXT = {
  title: '\uB808\uD37C\uB7F0\uC2A4 \uD3EC\uC988 \uC624\uBC84\uB808\uC774',
  descriptionSuffix: '\uC601\uC0C1 \uC704\uC5D0 \uD575\uC2EC \uAD00\uC808\uB9CC \uC815\uAD50\uD558\uAC8C \uACB9\uCCD0\uC11C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.',
  loading: '\uB808\uD37C\uB7F0\uC2A4 \uD3EC\uC988 \uC624\uBC84\uB808\uC774\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.',
  loadError: '\uB808\uD37C\uB7F0\uC2A4 \uD3EC\uC988 \uBBF8\uB9AC\uBCF4\uAE30\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
  drawError: '\uB808\uD37C\uB7F0\uC2A4 \uC601\uC0C1 \uC704\uC5D0 \uD3EC\uC988\uB97C \uADF8\uB9AC\uB294 \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.',
  analyzer: '\uBD84\uC11D\uAE30',
  sampleCount: '\uC0D8\uD50C \uC218',
  analyzedAt: '\uBD84\uC11D \uC2DC\uAC01',
  noRecord: '\uAE30\uB85D \uC5C6\uC74C',
  noFrames: '\uC774\uBC88 \uBD84\uC11D\uC5D0\uB294 \uD654\uBA74\uC6A9 \uD3EC\uC988 \uD504\uB808\uC784\uC774 \uC5C6\uC5B4 \uC624\uBC84\uB808\uC774\uB97C \uB9CC\uB4E4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
  sampleLabel: '\uC0D8\uD50C',
  startPose: '\uC2DC\uC791',
  middlePose: '\uC911\uAC04',
  endPose: '\uB9C8\uBB34\uB9AC',
  filterLabel: '\uD45C\uC2DC \uBD80\uC704',
  all: '\uC804\uCCB4',
  head: '\uBA38\uB9AC',
  torso: '\uBAB8\uD1B5',
  arms: '\uD314',
  legs: '\uB2E4\uB9AC',
};

const TILE_LABELS = [TEXT.startPose, TEXT.middlePose, TEXT.endPose];
const MIN_VISIBILITY = 0.2;
const OUT_OF_FRAME_MARGIN = 0.03;
const PART_COLORS: Record<RenderPart, string> = {
  head: '#ff9a3c',
  torso: '#f8fafc',
  arms: '#4fd8ff',
  legs: '#8af062',
};
const LEGEND_ITEMS: PartLegend[] = [
  { id: 'all', label: TEXT.all, color: 'linear-gradient(90deg, #ff9a3c 0%, #f8fafc 35%, #4fd8ff 65%, #8af062 100%)' },
  { id: 'head', label: TEXT.head, color: PART_COLORS.head },
  { id: 'torso', label: TEXT.torso, color: PART_COLORS.torso },
  { id: 'arms', label: TEXT.arms, color: PART_COLORS.arms },
  { id: 'legs', label: TEXT.legs, color: PART_COLORS.legs },
];

const CORE_SEGMENTS: Segment[] = [
  { start: 'left_ear', end: 'left_eye', part: 'head' },
  { start: 'left_eye', end: 'nose', part: 'head' },
  { start: 'nose', end: 'right_eye', part: 'head' },
  { start: 'right_eye', end: 'right_ear', part: 'head' },
  { start: 'left_shoulder', end: 'right_shoulder', part: 'torso' },
  { start: 'left_shoulder', end: 'left_hip', part: 'torso' },
  { start: 'right_shoulder', end: 'right_hip', part: 'torso' },
  { start: 'left_hip', end: 'right_hip', part: 'torso' },
  { start: 'left_shoulder', end: 'left_elbow', part: 'arms' },
  { start: 'left_elbow', end: 'left_wrist', part: 'arms' },
  { start: 'left_wrist', end: 'left_index', part: 'arms' },
  { start: 'left_wrist', end: 'left_thumb', part: 'arms' },
  { start: 'right_shoulder', end: 'right_elbow', part: 'arms' },
  { start: 'right_elbow', end: 'right_wrist', part: 'arms' },
  { start: 'right_wrist', end: 'right_index', part: 'arms' },
  { start: 'right_wrist', end: 'right_thumb', part: 'arms' },
  { start: 'left_hip', end: 'left_knee', part: 'legs' },
  { start: 'left_knee', end: 'left_ankle', part: 'legs' },
  { start: 'left_ankle', end: 'left_heel', part: 'legs' },
  { start: 'left_heel', end: 'left_foot_index', part: 'legs' },
  { start: 'right_hip', end: 'right_knee', part: 'legs' },
  { start: 'right_knee', end: 'right_ankle', part: 'legs' },
  { start: 'right_ankle', end: 'right_heel', part: 'legs' },
  { start: 'right_heel', end: 'right_foot_index', part: 'legs' },
];

const CORE_POINT_PARTS: Record<string, RenderPart> = {
  nose: 'head',
  left_eye_inner: 'head',
  left_eye: 'head',
  left_eye_outer: 'head',
  right_eye_inner: 'head',
  right_eye: 'head',
  right_eye_outer: 'head',
  left_ear: 'head',
  right_ear: 'head',
  mouth_left: 'head',
  mouth_right: 'head',
  left_shoulder: 'torso',
  right_shoulder: 'torso',
  left_hip: 'torso',
  right_hip: 'torso',
  left_elbow: 'arms',
  right_elbow: 'arms',
  left_wrist: 'arms',
  right_wrist: 'arms',
  left_thumb: 'arms',
  right_thumb: 'arms',
  left_index: 'arms',
  right_index: 'arms',
  left_knee: 'legs',
  right_knee: 'legs',
  left_ankle: 'legs',
  right_ankle: 'legs',
  left_heel: 'legs',
  right_heel: 'legs',
  left_foot_index: 'legs',
  right_foot_index: 'legs',
};

const LEGACY_NAME_MAP: Record<number, string> = {
  0: 'nose',
  1: 'left_eye_inner',
  2: 'left_eye',
  3: 'left_eye_outer',
  4: 'right_eye_inner',
  5: 'right_eye',
  6: 'right_eye_outer',
  7: 'left_ear',
  8: 'right_ear',
  9: 'mouth_left',
  10: 'mouth_right',
  11: 'left_shoulder',
  12: 'right_shoulder',
  13: 'left_elbow',
  14: 'right_elbow',
  15: 'left_wrist',
  16: 'right_wrist',
  17: 'left_pinky',
  18: 'right_pinky',
  19: 'left_index',
  20: 'right_index',
  21: 'left_thumb',
  22: 'right_thumb',
  23: 'left_hip',
  24: 'right_hip',
  25: 'left_knee',
  26: 'right_knee',
  27: 'left_ankle',
  28: 'right_ankle',
  29: 'left_heel',
  30: 'right_heel',
  31: 'left_foot_index',
  32: 'right_foot_index',
};

export function ChallengeReferencePosePreview({ challengeId, challengeTitle, enabled }: Props) {
  const [preview, setPreview] = useState<ChallengeReferencePosePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePart, setActivePart] = useState<PosePart>('all');
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadPreview() {
      setLoading(true);
      setError(null);

      try {
        const response = await getChallengeReferencePreview(challengeId);
        if (active) {
          setPreview(response);
        }
      } catch (loadError) {
        if (active) {
          setPreview(null);
          setError(loadError instanceof Error ? loadError.message : TEXT.loadError);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [challengeId, enabled]);

  useEffect(() => {
    if (!preview || preview.frames.length === 0) {
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = resolveApiUrl(preview.referenceVideoUrl);

    const draw = async () => {
      await waitForEvent(video, 'loadeddata');
      if (cancelled) {
        return;
      }

      const tiles = buildFrameTiles(preview.frames);
      const maxFrameIndex = Math.max(...preview.frames.map((frame) => frame.frameIndex), 1);
      const durationSeconds = video.duration && Number.isFinite(video.duration)
        ? video.duration
        : Math.max((preview.durationMs ?? 1000) / 1000, 0.1);

      for (let index = 0; index < tiles.length; index += 1) {
        if (cancelled) {
          return;
        }

        const canvas = canvasRefs.current[index];
        if (!canvas) {
          continue;
        }

        const timestamp = maxFrameIndex <= 0
          ? 0
          : Math.min(durationSeconds, Math.max(0, durationSeconds * (tiles[index].frame.frameIndex / maxFrameIndex)));

        video.currentTime = Math.min(timestamp, Math.max(durationSeconds - 0.05, 0));
        await waitForEvent(video, 'seeked');
        if (cancelled) {
          return;
        }

        drawFrameTile(canvas, video, tiles[index], activePart);
      }
    };

    void draw().catch(() => {
      if (!cancelled) {
        setError(TEXT.drawError);
      }
    });

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [preview, activePart]);

  return (
    <article className="panel panel--section reference-pose-preview">
      <div className="section-heading">
        <span className="section-heading__code">POSE</span>
        <div>
          <h2>{TEXT.title}</h2>
          <p>{`${challengeTitle} ${TEXT.descriptionSuffix}`}</p>
        </div>
      </div>

      {loading ? <p>{TEXT.loading}</p> : null}
      {error ? <p className="admin-form__message admin-form__message--error">{error}</p> : null}

      {!loading && !error && preview ? (
        <>
          <div className="reference-pose-preview__meta">
            <span>{`${TEXT.analyzer}: ${preview.analyzerName ?? 'unknown'}`}</span>
            <span>{`${TEXT.sampleCount}: ${preview.sampleCount ?? 0}`}</span>
            <span>
              {`${TEXT.analyzedAt}: `}
              {preview.analyzedAt ? new Date(preview.analyzedAt).toLocaleString('ko-KR') : TEXT.noRecord}
            </span>
          </div>

          <div className="reference-pose-preview__controls">
            <span className="reference-pose-preview__controls-label">{TEXT.filterLabel}</span>
            <div className="reference-pose-preview__filters">
              {LEGEND_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`reference-pose-preview__filter${activePart === item.id ? ' reference-pose-preview__filter--active' : ''}`}
                  onClick={() => setActivePart(item.id)}
                >
                  <span className="reference-pose-preview__swatch" style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="reference-pose-preview__legend">
            {LEGEND_ITEMS.filter((item) => item.id !== 'all').map((item) => (
              <div key={item.id} className="reference-pose-preview__legend-item">
                <span className="reference-pose-preview__swatch" style={{ background: item.color }} />
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>

          <div className="reference-pose-preview__grid">
            {buildFrameTiles(preview.frames).map((tile, index) => (
              <figure key={`${tile.label}-${tile.frame.frameIndex}`} className="reference-pose-preview__tile">
                <canvas
                  ref={(node) => {
                    canvasRefs.current[index] = node;
                  }}
                />
                <figcaption>
                  <strong>{tile.label}</strong>
                  <span>{`frame ${tile.frame.frameIndex}`}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      ) : null}

      {!loading && !error && preview && preview.frames.length === 0 ? <p>{TEXT.noFrames}</p> : null}
    </article>
  );
}

function buildFrameTiles(frames: ChallengeReferencePoseFrame[]): FrameTile[] {
  return frames.map((frame, index) => ({
    frame,
    label: TILE_LABELS[index] ?? `${TEXT.sampleLabel} ${index + 1}`,
  }));
}

function drawFrameTile(canvas: HTMLCanvasElement, video: HTMLVideoElement, tile: FrameTile, activePart: PosePart) {
  const width = video.videoWidth || 360;
  const height = video.videoHeight || 640;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const normalizedPoints = normalizePoints(tile.frame.points);
  const pointMap = new Map(normalizedPoints.map((point) => [point.name, point]));
  const visibleParts = activePart === 'all'
    ? (['head', 'torso', 'arms', 'legs'] as RenderPart[])
    : [activePart];

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
  context.fillStyle = 'rgba(4, 10, 20, 0.10)';
  context.fillRect(0, 0, width, height);

  drawTorsoFill(context, pointMap, width, height, visibleParts);

  for (const segment of CORE_SEGMENTS) {
    if (!visibleParts.includes(segment.part)) {
      continue;
    }

    const start = pointMap.get(segment.start);
    const end = pointMap.get(segment.end);
    if (!isRenderablePoint(start) || !isRenderablePoint(end) || !start || !end) {
      continue;
    }

    context.beginPath();
    context.strokeStyle = segment.part === 'torso' ? PART_COLORS.torso : PART_COLORS[segment.part];
    context.lineWidth = segment.part === 'torso' ? Math.max(5, width / 92) : Math.max(3.5, width / 118);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.moveTo(start.x * width, start.y * height);
    context.lineTo(end.x * width, end.y * height);
    context.stroke();
  }

  for (const point of normalizedPoints) {
    if (!isRenderablePoint(point)) {
      continue;
    }

    const part = resolvePointPart(point.name);
    if (!visibleParts.includes(part)) {
      continue;
    }

    const radius = computePointRadius(point.name, width);
    context.beginPath();
    context.fillStyle = PART_COLORS[part];
    context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.strokeStyle = 'rgba(248, 250, 252, 0.95)';
    context.lineWidth = 2;
    context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawTorsoFill(
  context: CanvasRenderingContext2D,
  pointMap: Map<string, ChallengeReferencePosePoint>,
  width: number,
  height: number,
  visibleParts: RenderPart[],
) {
  if (!visibleParts.includes('torso')) {
    return;
  }

  const leftShoulder = pointMap.get('left_shoulder');
  const rightShoulder = pointMap.get('right_shoulder');
  const rightHip = pointMap.get('right_hip');
  const leftHip = pointMap.get('left_hip');
  if (!isRenderablePoint(leftShoulder) || !isRenderablePoint(rightShoulder) || !isRenderablePoint(rightHip) || !isRenderablePoint(leftHip) || !leftShoulder || !rightShoulder || !rightHip || !leftHip) {
    return;
  }

  context.beginPath();
  context.moveTo(leftShoulder.x * width, leftShoulder.y * height);
  context.lineTo(rightShoulder.x * width, rightShoulder.y * height);
  context.lineTo(rightHip.x * width, rightHip.y * height);
  context.lineTo(leftHip.x * width, leftHip.y * height);
  context.closePath();
  context.fillStyle = 'rgba(248, 250, 252, 0.12)';
  context.fill();
}

function normalizePoints(points: ChallengeReferencePosePoint[]): ChallengeReferencePosePoint[] {
  return points
    .map((point) => ({
      ...point,
      name: normalizePointName(point.name),
    }))
    .filter((point) => CORE_POINT_PARTS[point.name] != null);
}

function normalizePointName(name: string): string {
  if (CORE_POINT_PARTS[name]) {
    return name;
  }

  const match = /^landmark_(\d+)$/.exec(name);
  if (!match) {
    return name;
  }

  const index = Number(match[1]);
  return LEGACY_NAME_MAP[index] ?? name;
}

function resolvePointPart(name: string): RenderPart {
  return CORE_POINT_PARTS[name] ?? 'torso';
}

function computePointRadius(name: string, width: number): number {
  if (name.includes('eye') || name.includes('ear') || name.includes('mouth')) {
    return Math.max(3.5, width / 120);
  }
  if (name.includes('thumb') || name.includes('index') || name.includes('heel') || name.includes('foot')) {
    return Math.max(4, width / 110);
  }
  return Math.max(5.5, width / 80);
}

function isRenderablePoint(point: ChallengeReferencePosePoint | undefined) {
  return !!point
    && point.visibility >= MIN_VISIBILITY
    && point.x >= -OUT_OF_FRAME_MARGIN
    && point.x <= 1 + OUT_OF_FRAME_MARGIN
    && point.y >= -OUT_OF_FRAME_MARGIN
    && point.y <= 1 + OUT_OF_FRAME_MARGIN;
}

function waitForEvent(target: HTMLVideoElement, eventName: 'loadeddata' | 'seeked') {
  return new Promise<void>((resolve, reject) => {
    const handleSuccess = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error(`video event failed: ${eventName}`));
    };

    const cleanup = () => {
      target.removeEventListener(eventName, handleSuccess);
      target.removeEventListener('error', handleError);
    };

    target.addEventListener(eventName, handleSuccess, { once: true });
    target.addEventListener('error', handleError, { once: true });
  });
}
