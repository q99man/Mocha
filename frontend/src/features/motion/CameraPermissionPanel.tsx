import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAttempt, uploadAttemptVideo } from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import type { MotionSessionState } from '../../shared/types/motion';
import type {
  AttemptRecordType,
  AttemptSummary,
  AttemptVideoResult,
} from '../../shared/types/attempt';

type CameraState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'missing'
  | 'unavailable'
  | 'unsupported'
  | 'error';

type FlowStage = 'camera-check' | 'camera-ready' | 'recording-placeholder';

type CameraPermissionPanelProps = {
  challengeId: number;
  challengeTitle?: string;
};

const DEFAULT_MESSAGE = '카메라 권한을 확인하면 실제 도전 흐름으로 들어가기 전 준비 단계를 확인할 수 있습니다.';

export function CameraPermissionPanel({ challengeId, challengeTitle }: CameraPermissionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [flowStage, setFlowStage] = useState<FlowStage>('camera-check');
  const [sessionState, setSessionState] = useState<MotionSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<AttemptSummary | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttempt, setUploadedAttempt] = useState<AttemptVideoResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMotionSessionState() {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const response = await getMotionSessionState(challengeId);
        if (active) {
          setSessionState(response);
          setMessage(response.message);
        }
      } catch (error) {
        if (active) {
          setSessionError(error instanceof Error ? error.message : '세션 준비 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    }

    void loadMotionSessionState();

    return () => {
      active = false;
      stopStream();
    };
  }, [challengeId]);

  async function requestCameraAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setMessage('현재 브라우저에서는 카메라 접근을 지원하지 않습니다. 그래도 아래 흐름 미리보기와 비디오 업로드는 계속 확인할 수 있습니다.');
      return;
    }

    setCameraState('requesting');
    setSaveError(null);
    setUploadError(null);
    setMessage('카메라 권한을 요청하고 있습니다...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      stopStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraState('granted');
      setFlowStage('camera-ready');
      setMessage('카메라 준비가 완료되었습니다. 이제 실제 도전 시작 전 안내 화면으로 이동할 수 있습니다.');
    } catch (error) {
      handleCameraError(error);
    }
  }

  function handleCameraError(error: unknown) {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          setCameraState('denied');
          setMessage('카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 다시 허용하거나, 카메라 없이도 프로토타입 흐름은 계속 확인할 수 있습니다.');
          return;
        case 'NotFoundError':
          setCameraState('missing');
          setMessage('사용 가능한 카메라를 찾지 못했습니다. 카메라가 없는 환경이어도 비디오 업로드 기반 프로토타입은 계속 진행할 수 있습니다.');
          return;
        case 'NotReadableError':
          setCameraState('unavailable');
          setMessage('카메라 장치에 접근할 수 없습니다. 다른 앱이 사용 중이거나 운영체제 권한이 막혀 있을 수 있습니다. 그래도 업로드 기반 흐름은 계속 확인할 수 있습니다.');
          return;
        default:
          setCameraState('error');
          setMessage('카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나, 카메라 없이 업로드 흐름만 먼저 확인해 보세요.');
          return;
      }
    }

    setCameraState('error');
    setMessage('카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나, 카메라 없이 업로드 흐름만 먼저 확인해 보세요.');
  }

  function moveToRecordingPlaceholder() {
    setFlowStage('recording-placeholder');
    setSaveError(null);
    setUploadError(null);
    setMessage('실제 녹화 기능은 아직 없지만, 이 화면에서 시도 비디오 업로드와 결과 흐름을 먼저 확인할 수 있습니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('recording-placeholder');
    setSaveError(null);
    setUploadError(null);
    setMessage('카메라 없이도 프로토타입 흐름은 계속 진행할 수 있습니다. 비디오 업로드와 결과 저장 흐름을 확인해 보세요.');
  }

  async function saveAttempt(recordType: AttemptRecordType) {
    setSaveLoading(true);
    setSaveError(null);
    setUploadedAttempt(null);

    try {
      const response = await createAttempt({
        challengeId,
        score: buildPreviewScore(recordType, cameraState),
        notes: buildAttemptNote(cameraState, recordType),
        recordType,
      });
      setSavedAttempt(response);
      setMessage(
        recordType === 'completed'
          ? '샘플 완료 결과가 저장되었습니다. 결과 화면에서 현재 scoring 구조를 바로 확인할 수 있습니다.'
          : '카메라 준비 상태가 저장되었습니다. 결과 화면으로 이동해 다음 단계 흐름을 확인해 보세요.',
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '도전 기록을 저장하지 못했습니다.');
    } finally {
      setSaveLoading(false);
    }
  }

  async function submitAttemptVideo() {
    if (!selectedVideo) {
      setUploadError('업로드할 시도 비디오를 먼저 선택해 주세요.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setSavedAttempt(null);

    try {
      const response = await uploadAttemptVideo({
        challengeId,
        notes: buildVideoAttemptNote(cameraState),
        attemptVideo: selectedVideo,
      });
      setUploadedAttempt(response);
      setMessage('시도 비디오 업로드와 자동 채점이 완료되었습니다. 결과 화면으로 이동해 점수와 요약을 확인해 보세요.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '시도 비디오를 업로드하지 못했습니다.');
    } finally {
      setUploadLoading(false);
    }
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetCamera() {
    stopStream();
    setCameraState('idle');
    setFlowStage('camera-check');
    setSavedAttempt(null);
    setSelectedVideo(null);
    setUploadedAttempt(null);
    setSaveError(null);
    setUploadError(null);
    setMessage(sessionState?.message ?? DEFAULT_MESSAGE);
  }

  const canContinueWithoutCamera =
    cameraState === 'missing' ||
    cameraState === 'unavailable' ||
    cameraState === 'unsupported' ||
    cameraState === 'denied' ||
    cameraState === 'error';

  return (
    <section className="panel">
      <h2>{challengeTitle ? `${challengeTitle} 준비 화면` : '카메라 준비 화면'}</h2>
      {sessionLoading ? <p>세션 준비 정보를 불러오는 중입니다...</p> : null}
      {!sessionLoading && sessionError ? <p>{sessionError}</p> : null}
      {!sessionLoading && !sessionError ? <p>{message}</p> : null}

      {sessionState ? (
        <div className="camera-panel__contract">
          <div className="camera-panel__status">
            <span className="pill">세션 상태</span>
            <strong>{sessionStateLabel(sessionState.sessionState)}</strong>
          </div>
          <div className="camera-panel__status">
            <span className="pill">다음 단계</span>
            <strong>{nextActionLabel(sessionState.nextAction)}</strong>
          </div>
        </div>
      ) : null}

      <div className="camera-panel__actions">
        <button
          className="button-link"
          type="button"
          onClick={requestCameraAccess}
          disabled={cameraState === 'requesting' || sessionLoading || Boolean(sessionError)}
        >
          {cameraState === 'requesting' ? '권한 요청 중...' : '카메라 권한 확인'}
        </button>
        {cameraState === 'granted' ? (
          <button className="button-link button-link--secondary" type="button" onClick={resetCamera}>
            다시 준비하기
          </button>
        ) : null}
        {canContinueWithoutCamera ? (
          <button className="button-link button-link--secondary" type="button" onClick={continueWithoutCamera}>
            카메라 없이 흐름 계속 보기
          </button>
        ) : null}
      </div>

      <div className="camera-panel__status">
        <span className="pill">카메라 상태</span>
        <strong>{cameraStateLabel(cameraState)}</strong>
      </div>

      {cameraState === 'granted' ? (
        <>
          <div className="camera-preview">
            <video ref={videoRef} className="camera-preview__video" autoPlay muted playsInline />
          </div>

          {flowStage === 'camera-ready' ? (
            <div className="session-placeholder">
              <span className="pill">준비 완료</span>
              <h3>도전 시작 전 확인</h3>
              <p>카메라가 정상적으로 연결되었습니다. 다음 단계에서는 카운트다운과 도전 시작 UI가 이 영역에 들어올 예정입니다.</p>
              <div className="detail-flow">
                <div className="detail-flow__item">1. 카메라 구도 확인</div>
                <div className="detail-flow__item">2. 자세 준비</div>
                <div className="detail-flow__item">3. 도전 시작 대기</div>
              </div>
              <div className="camera-panel__actions">
                <button className="button-link" type="button" onClick={moveToRecordingPlaceholder}>
                  다음 단계 미리 보기
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="camera-preview camera-preview--placeholder">
          <p>{cameraPlaceholderMessage(cameraState)}</p>
        </div>
      )}

      {flowStage === 'recording-placeholder' ? (
        <div className="session-placeholder session-placeholder--active">
          <span className="pill">녹화 준비 상태</span>
          <h3>시도 비디오 업로드와 결과 흐름</h3>
          <p>실제 브라우저 녹화는 아직 없지만, 지금 단계에서는 시도 비디오를 직접 올려 자동 채점 흐름을 데모할 수 있습니다.</p>
          <ul className="detail-list">
            <li>
              <strong>실제 업로드 경로</strong>
              레퍼런스 분석이 끝난 챌린지라면 이 화면에서 시도 비디오를 올리고 서버가 점수를 자동 계산합니다.
            </li>
            <li>
              <strong>프로토타입 저장 경로</strong>
              아직 녹화가 없더라도 준비 상태 저장 또는 샘플 완료 결과 저장으로 흐름을 먼저 검증할 수 있습니다.
            </li>
            <li>
              <strong>결과 화면 연결</strong>
              업로드 또는 샘플 저장이 끝나면 결과 화면에서 현재 상태와 요약 문구를 바로 확인할 수 있습니다.
            </li>
          </ul>

          <div className="upload-box">
            <label className="upload-box__label" htmlFor="attempt-video-input">
              시도 비디오 선택
            </label>
            <input
              id="attempt-video-input"
              className="upload-box__input"
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedVideo(file);
                setUploadError(null);
              }}
            />
            <p className="upload-box__hint">
              MP4 등 일반적인 비디오 파일을 선택해 주세요. 지금은 로컬 저장 + mock 분석 기준으로 동작합니다.
            </p>
            {selectedVideo ? (
              <p className="upload-box__file">
                선택한 파일: <strong>{selectedVideo.name}</strong> ({formatBytes(selectedVideo.size)})
              </p>
            ) : null}
          </div>

          <div className="camera-panel__actions">
            <button className="button-link" type="button" onClick={() => void submitAttemptVideo()} disabled={uploadLoading}>
              {uploadLoading ? '비디오 업로드 중...' : '시도 비디오 업로드 후 자동 채점'}
            </button>
            <button className="button-link button-link--secondary" type="button" onClick={() => void saveAttempt('prepared')} disabled={saveLoading || uploadLoading}>
              {saveLoading ? '기록 저장 중...' : '준비 상태 저장'}
            </button>
            <button className="button-link button-link--secondary" type="button" onClick={() => void saveAttempt('completed')} disabled={saveLoading || uploadLoading}>
              {saveLoading ? '기록 저장 중...' : '샘플 완료 결과 저장'}
            </button>
            <button
              className="button-link button-link--secondary"
              type="button"
              onClick={() => setFlowStage(cameraState === 'granted' ? 'camera-ready' : 'camera-check')}
            >
              이전 단계 보기
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? <p>{saveError}</p> : null}
      {uploadError ? <p>{uploadError}</p> : null}

      {uploadedAttempt ? (
        <div className="camera-panel__saved">
          <span className="pill">자동 채점 완료</span>
          <p>
            업로드한 비디오로 <strong>{uploadedAttempt.score}점</strong>이 계산되었습니다. ({uploadedAttempt.scoreAvailable ? '점수 사용 가능' : '점수 준비 중'})
          </p>
          <p><strong>{uploadedAttempt.resultHeadline}</strong></p>
          <p>{uploadedAttempt.resultSummary}</p>
          <p>
            분석기: {uploadedAttempt.analyzerName} / 파일: {uploadedAttempt.videoOriginalFileName}
          </p>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${uploadedAttempt.attemptId}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              저장된 기록 보기
            </Link>
          </div>
        </div>
      ) : null}

      {savedAttempt ? (
        <div className="camera-panel__saved">
          <span className="pill">저장 완료</span>
          <p>기록 ID {savedAttempt.id}번이 저장되었습니다.</p>
          <p>
            현재 저장된 상태는 {savedAttempt.status}이고, 점수는 {savedAttempt.score}점입니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${savedAttempt.id}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              저장된 기록 보기
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildPreviewScore(recordType: AttemptRecordType, cameraState: CameraState): number {
  if (recordType === 'prepared') {
    return 0;
  }

  return cameraState === 'granted' ? 82 : 68;
}

function buildAttemptNote(cameraState: CameraState, recordType: AttemptRecordType): string {
  if (recordType === 'completed') {
    if (cameraState === 'granted') {
      return '샘플 simple scoring 결과를 반영한 완료 기록';
    }

    return '카메라 없이 프로토타입 흐름에서 만든 샘플 완료 기록';
  }

  switch (cameraState) {
    case 'granted':
      return '카메라 권한 확인 후 녹화 준비 단계 진입';
    case 'missing':
      return '카메라 장치가 없는 상태에서 프로토타입 흐름 진행';
    case 'unavailable':
      return '카메라 장치 접근 불가 상태에서 프로토타입 흐름 진행';
    case 'unsupported':
      return '브라우저 미지원 환경에서 프로토타입 흐름 진행';
    case 'denied':
      return '카메라 권한 거부 상태에서 프로토타입 흐름 진행';
    default:
      return '카메라 없이 프로토타입 흐름 진행';
  }
}

function buildVideoAttemptNote(cameraState: CameraState): string {
  switch (cameraState) {
    case 'granted':
      return '카메라 준비 확인 후 시도 비디오 업로드';
    case 'missing':
      return '카메라 없는 환경에서 시도 비디오 업로드';
    case 'unavailable':
      return '카메라 접근 불가 환경에서 시도 비디오 업로드';
    case 'unsupported':
      return '브라우저 미지원 환경에서 시도 비디오 업로드';
    case 'denied':
      return '카메라 권한 거부 후 시도 비디오 업로드';
    default:
      return '프로토타입 시작 화면에서 시도 비디오 업로드';
  }
}

function cameraPlaceholderMessage(state: CameraState): string {
  switch (state) {
    case 'missing':
      return '이 기기에서 사용할 수 있는 카메라를 찾지 못했습니다. 그래도 아래 단계 안내와 비디오 업로드 흐름은 계속 확인할 수 있습니다.';
    case 'unavailable':
      return '카메라 장치에 접근할 수 없습니다. 다른 앱 사용 여부를 확인하거나, 카메라 없이 업로드 흐름만 먼저 확인해 보세요.';
    case 'unsupported':
      return '현재 브라우저에서는 카메라 기능을 지원하지 않습니다. 그래도 프로토타입 흐름은 계속 진행할 수 있습니다.';
    case 'denied':
      return '카메라 권한이 거부된 상태입니다. 권한을 다시 허용하거나, 카메라 없이도 흐름을 계속 볼 수 있습니다.';
    case 'error':
      return '카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나, 카메라 없이도 흐름을 계속 확인할 수 있습니다.';
    default:
      return '카메라 권한을 허용하면 이 영역에 미리보기가 표시됩니다.';
  }
}

function cameraStateLabel(state: CameraState): string {
  switch (state) {
    case 'idle':
      return '대기 중';
    case 'requesting':
      return '권한 요청 중';
    case 'granted':
      return '준비 완료';
    case 'denied':
      return '권한 거부';
    case 'missing':
      return '카메라 없음';
    case 'unavailable':
      return '장치 사용 불가';
    case 'unsupported':
      return '브라우저 미지원';
    case 'error':
      return '오류 발생';
    default:
      return '상태 없음';
  }
}

function sessionStateLabel(state: MotionSessionState['sessionState']): string {
  switch (state) {
    case 'READY':
      return '세션 준비됨';
    default:
      return '상태 없음';
  }
}

function nextActionLabel(action: MotionSessionState['nextAction']): string {
  switch (action) {
    case 'REQUEST_CAMERA_PERMISSION':
      return '카메라 권한 확인';
    default:
      return '상태 없음';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
