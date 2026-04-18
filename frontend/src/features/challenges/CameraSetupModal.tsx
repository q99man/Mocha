import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type CameraSetupModalProps = {
  challengeTitle: string;
  onConfirm: () => void;
  onClose: () => void;
};

type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

export function CameraSetupModal({ challengeTitle, onConfirm, onClose }: CameraSetupModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');

  useEffect(() => {
    document.body.classList.add('body--modal-open');

    return () => {
      document.body.classList.remove('body--modal-open');
      stopStream();
    };
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function requestCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stopStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus('ready');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setStatus('denied');
      } else if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) {
        setStatus('unavailable');
      } else {
        setStatus('error');
      }
    }
  }

  function handleConfirm() {
    stopStream();
    onConfirm();
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  function statusLabel() {
    switch (status) {
      case 'idle':
        return '아래 버튼을 눌러 카메라를 확인하세요.';
      case 'requesting':
        return '카메라 접근을 요청하는 중...';
      case 'ready':
        return '카메라가 정상 작동합니다. 시작할 준비가 되었습니다!';
      case 'denied':
        return '카메라 권한이 거부되었습니다. 카메라 없이도 계속할 수 있습니다.';
      case 'unavailable':
        return '사용 가능한 카메라가 없습니다. 테스트 모드로 진행할 수 있습니다.';
      case 'error':
        return '카메라 접근에 실패했습니다. 카메라 없이 계속할 수 있습니다.';
    }
  }

  const statusDotClass =
    status === 'ready'
      ? 'camera-modal__status-dot--ready'
      : status === 'denied' || status === 'unavailable' || status === 'error'
        ? 'camera-modal__status-dot--error'
        : '';

  const canProceed = status === 'ready' || status === 'denied' || status === 'unavailable' || status === 'error';

  const modal = (
    <div className="camera-modal-backdrop" onClick={handleClose}>
      <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal__header">
          <div>
            <h3>카메라 설정</h3>
            <p>{challengeTitle} — 시작 전 카메라를 점검합니다</p>
          </div>
          <button type="button" className="camera-modal__close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="camera-modal__preview">
          {status === 'ready' ? (
            <video ref={videoRef} autoPlay muted playsInline />
          ) : (
            <>
              <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
              <div className="camera-modal__preview-placeholder">
                <span>📷 카메라 미리보기</span>
              </div>
            </>
          )}
        </div>

        <div className="camera-modal__status">
          <span className={`camera-modal__status-dot ${statusDotClass}`} />
          <span>{statusLabel()}</span>
        </div>

        <div className="camera-modal__actions">
          {status !== 'ready' && (
            <button
              type="button"
              className="camera-modal__btn"
              onClick={() => void requestCamera()}
              disabled={status === 'requesting'}
            >
              {status === 'requesting' ? '확인 중...' : '카메라 확인'}
            </button>
          )}
          {canProceed && (
            <button type="button" className="camera-modal__btn camera-modal__btn--primary" onClick={handleConfirm}>
              {status === 'ready' ? '시작하기' : '카메라 없이 계속 (테스트 모드)'}
            </button>
          )}
          <button type="button" className="camera-modal__btn camera-modal__btn--secondary" onClick={handleClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
