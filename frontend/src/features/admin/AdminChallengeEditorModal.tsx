import { createPortal } from 'react-dom';

import { getDifficultyOptions } from '../../features/challenges/difficulty';
import { CompactFileField } from '../../shared/components/CompactFileField';

type ChallengeFormState = {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnailUrl: string;
  guideVideoUrl: string;
  durationSec: string;
};

type AdminChallengeEditorModalProps = {
  open: boolean;
  editingChallengeId: number | null;
  challengeSubmitting: boolean;
  challengeForm: ChallengeFormState;
  challengeDifficultyLevel: string;
  selectedReferenceVideo: File | null;
  challengeError: string | null;
  modalTitle: string;
  modalDescription: string;
  modalDurationLabel: string;
  modalGuideLabel: string;
  modalThumbnailLabel: string;
  modalReferenceLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  onSetChallengeForm: (updater: (current: ChallengeFormState) => ChallengeFormState) => void;
  onSetDifficultyLevel: (value: string) => void;
  onSelectReferenceVideo: (file: File | null) => void;
};

export function AdminChallengeEditorModal({
  open,
  editingChallengeId,
  challengeSubmitting,
  challengeForm,
  challengeDifficultyLevel,
  selectedReferenceVideo,
  challengeError,
  modalTitle,
  modalDescription,
  modalDurationLabel,
  modalGuideLabel,
  modalThumbnailLabel,
  modalReferenceLabel,
  onClose,
  onSubmit,
  onSetChallengeForm,
  onSetDifficultyLevel,
  onSelectReferenceVideo,
}: AdminChallengeEditorModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="glass-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-modal-title">
      <div className="glass-modal__backdrop" onClick={onClose} />
      <div className="glass-modal__panel admin-hub-compact__modal-panel">
        <form
          className="glass-panel glass-form admin-hub-compact__modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="glass-toolbar admin-hub-compact__modal-header">
            <div>
              <h3 className="glass-section-title" id="challenge-modal-title">
                {modalTitle}
              </h3>
              <p className="glass-toolbar__note">{modalDescription}</p>
            </div>
            <button
              className="button-link button-link--secondary admin-hub-compact__modal-btn"
              type="button"
              onClick={onClose}
              disabled={challengeSubmitting}
            >
              닫기
            </button>
          </div>

          <div className="admin-hub-compact__modal-summary">
            <div className="admin-hub-compact__summary-card">
              <span>작업 모드</span>
              <strong>{editingChallengeId ? `수정 · #${editingChallengeId}` : '신규 등록'}</strong>
            </div>
            <div className="admin-hub-compact__summary-card">
              <span>난이도 / 길이</span>
              <strong>
                {challengeDifficultyLevel} / {modalDurationLabel}
              </strong>
            </div>
            <div className="admin-hub-compact__summary-card">
              <span>가이드 / 썸네일</span>
              <strong>
                {modalGuideLabel} · {modalThumbnailLabel}
              </strong>
            </div>
            <div className="admin-hub-compact__summary-card">
              <span>레퍼런스 영상</span>
              <strong>{modalReferenceLabel}</strong>
            </div>
          </div>

          <div className="admin-hub-compact__modal-grid">
            <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">기본 정보</div>
            <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
              <span>챌린지 제목</span>
              <input
                type="text"
                value={challengeForm.title}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="예: 사이드 스텝 테스트"
              />
            </label>
            <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
              <span>설명</span>
              <textarea
                value={challengeForm.description}
                rows={4}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="레퍼런스 동작 설명"
              />
            </label>

            <label className="glass-field admin-hub-compact__modal-field">
              <span>카테고리</span>
              <input
                type="text"
                value={challengeForm.category}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, category: event.target.value }))}
              />
            </label>
            <label className="glass-field admin-hub-compact__modal-field">
              <span>난이도</span>
              <div className="admin-hub-compact__difficulty-field">
                <div className="admin-hub-compact__difficulty-current">
                  <strong>{challengeDifficultyLevel}</strong>
                  <span>선택한 난이도</span>
                </div>
                <div className="admin-hub-compact__difficulty-picker" role="radiogroup" aria-label="난이도 선택">
                  {getDifficultyOptions().map((level) => {
                    const isActive = challengeDifficultyLevel === String(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        className={`admin-hub-compact__difficulty-option${isActive ? ' is-active' : ''}`}
                        aria-pressed={isActive}
                        onClick={() => onSetDifficultyLevel(String(level))}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </label>
            <label className="glass-field admin-hub-compact__modal-field">
              <span>길이(초)</span>
              <input
                type="number"
                min={5}
                max={600}
                value={challengeForm.durationSec}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, durationSec: event.target.value }))}
              />
            </label>

            <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">미디어 연결</div>
            <label className="glass-field admin-hub-compact__modal-field">
              <span>썸네일 URL</span>
              <input
                type="text"
                value={challengeForm.thumbnailUrl}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, thumbnailUrl: event.target.value }))}
                placeholder="선택"
              />
            </label>
            <label className="glass-field admin-hub-compact__modal-field">
              <span>가이드 영상 URL</span>
              <input
                type="text"
                value={challengeForm.guideVideoUrl}
                onChange={(event) => onSetChallengeForm((current) => ({ ...current, guideVideoUrl: event.target.value }))}
                placeholder="선택"
              />
            </label>

            <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">레퍼런스 자료</div>
            <div className="admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
              <CompactFileField
                label={editingChallengeId ? '레퍼런스 영상 교체(선택)' : '레퍼런스 영상'}
                accept="video/*"
                buttonLabel="영상 선택"
                emptyLabel={editingChallengeId ? '기존 레퍼런스 영상을 유지합니다.' : '업로드할 영상을 선택해 주세요.'}
                selectedFileName={selectedReferenceVideo?.name ?? null}
                disabled={challengeSubmitting}
                onSelect={onSelectReferenceVideo}
              />
            </div>
          </div>

          <div className="inline-actions admin-hub-compact__modal-actions">
            <button className="button-link admin-hub-compact__modal-btn" type="submit" disabled={challengeSubmitting}>
              {challengeSubmitting ? (editingChallengeId ? '수정 중...' : '생성 중...') : editingChallengeId ? '수정 저장' : '챌린지 생성'}
            </button>
            <button
              className="button-link button-link--secondary admin-hub-compact__modal-btn"
              type="button"
              onClick={onClose}
              disabled={challengeSubmitting}
            >
              취소
            </button>
          </div>
          {selectedReferenceVideo ? (
            <p className="glass-toolbar__note admin-hub-compact__modal-note">선택 영상: {selectedReferenceVideo.name}</p>
          ) : null}
          {editingChallengeId ? (
            <p className="glass-toolbar__note admin-hub-compact__modal-note">수정 중 챌린지 ID: #{editingChallengeId}</p>
          ) : null}
          {challengeError ? <p className="review-composer__message review-composer__message--error">{challengeError}</p> : null}
        </form>
      </div>
    </div>,
    document.body,
  );
}
