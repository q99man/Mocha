import { Fragment } from 'react';

import {
  IconAdd,
  IconDelete,
  IconSave,
  IconStatus,
} from '../../shared/components/AdminIcons';
import { CompactFileField } from '../../shared/components/CompactFileField';
import { CompactFilterDropdown } from '../../shared/components/CompactFilterDropdown';
import { Pagination } from '../../shared/components/Pagination';
import type { ModelAsset } from '../../shared/types/admin';

type AdminAssetsSectionProps = {
  loading: boolean;
  assets: ModelAsset[];
  activeAsset: ModelAsset | null;
  modelSummary: string;
  selectedModelFile: File | null;
  versionLabel: string;
  uploading: boolean;
  deletingAssetId: number | null;
  updatingAssetId?: number | null;
  expandedAssetId: number | null;
  assetPage: number;
  assetTotalPages: number;
  assetVersionDrafts?: Record<number, string>;
  setVersionLabel: (value: string) => void;
  onSelectModelFile: (file: File | null) => void;
  onSubmitModel: () => void;
  onToggleAssetRow: (assetId: number) => void;
  onConfirmDeleteAsset: (asset: ModelAsset) => void;
  onChangeAssetVersionDraft?: (assetId: number, value: string) => void;
  onSaveAsset?: (asset: ModelAsset) => void;
  onActivateAsset?: (asset: ModelAsset) => void;
  onSelectActiveAsset?: (asset: ModelAsset) => void;
  onAssetPageChange: (page: number) => void;
  buildActiveDescription: (asset: ModelAsset) => string;
  formatFileSize: (size: number) => string;
  formatDateTime: (value: string) => string;
  formatDateTimeFull: (value: string) => string;
};

export function AdminAssetsSection({
  loading,
  assets,
  activeAsset,
  selectedModelFile,
  versionLabel,
  uploading,
  deletingAssetId,
  updatingAssetId,
  expandedAssetId,
  assetPage,
  assetTotalPages,
  assetVersionDrafts,
  setVersionLabel,
  onSelectModelFile,
  onSubmitModel,
  onToggleAssetRow,
  onConfirmDeleteAsset,
  onChangeAssetVersionDraft,
  onSaveAsset,
  onActivateAsset,
  onSelectActiveAsset,
  onAssetPageChange,
  formatFileSize,
  formatDateTime,
  formatDateTimeFull,
}: AdminAssetsSectionProps) {
  const pagedAssets = assets.slice((assetPage - 1) * 5, (assetPage - 1) * 5 + 5);
  const activeAssetId = activeAsset?.id ?? '';
  const activeSelectDisabled = loading || uploading || Boolean(updatingAssetId) || assets.length === 0;

  function handleActiveAssetChange(assetId: string) {
    const nextAsset = assets.find((asset) => String(asset.id) === assetId);
    if (!nextAsset || nextAsset.active) {
      return;
    }

    onSelectActiveAsset?.(nextAsset);
  }

  return (
    <section className="admin-hub-compact__section admin-shell-compact__section">
      <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
        <div>
          <h3 className="glass-section-title">모델 관리</h3>
        </div>
        <div className="board-detail-compact__meta">
          <span className="board-classic-badge">{assets.length}개 자산</span>
          <span className={`board-classic-badge ${activeAsset ? 'is-success' : 'is-warning'}`}>
            {activeAsset ? '활성 모델 있음' : '모델 필요'}
          </span>
        </div>
      </div>

      <div className="admin-hub-compact__model-picker">
        <CompactFilterDropdown
          className="mypage-inline-field admin-hub-compact__model-select"
          label="활성 모델 선택"
          value={String(activeAssetId)}
          disabled={activeSelectDisabled || !onSelectActiveAsset}
          options={assets.map((asset) => ({
            value: String(asset.id),
            label: formatModelOptionLabel(asset, formatFileSize),
          }))}
          onChange={(value) => handleActiveAssetChange(value)}
        />
        <p className="admin-hub-compact__model-picker-note">
          {activeAsset
            ? `현재 적용 중: ${activeAsset.versionLabel ?? activeAsset.originalFileName}`
            : '활성 모델을 선택하면 런타임 모델 파일이 즉시 교체됩니다.'}
        </p>
      </div>

      <form
        className="admin-hub-compact__upload"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitModel();
        }}
      >
        <CompactFileField
          label="모델 파일"
          accept=".task"
          buttonLabel="모델 선택"
          emptyLabel="task 모델 파일을 선택해 주세요."
          selectedFileName={selectedModelFile?.name ?? null}
          disabled={uploading}
          onSelect={onSelectModelFile}
        />
        <label className="mypage-inline-field">
          <span>버전 라벨</span>
          <input
            type="text"
            value={versionLabel}
            onChange={(event) => setVersionLabel(event.target.value)}
            placeholder="예: lite-v1"
          />
        </label>
        <div className="admin-hub-compact__upload-actions">
          <button className="button-link button-link--compact admin-action-button" type="submit" disabled={uploading}>
            <IconAdd />
            <span>{uploading ? '업로드 중...' : '모델 업로드'}</span>
          </button>
        </div>
      </form>

      {loading ? (
        <div className="board-compact-empty">
          <strong>모델 자산을 불러오는 중입니다.</strong>
        </div>
      ) : pagedAssets.length === 0 ? (
        <div className="board-compact-empty">
          <strong>등록된 모델 자산이 없습니다.</strong>
        </div>
      ) : (
        <div className="admin-hub-compact-table">
          <div className="admin-hub-compact-table__head admin-hub-compact-table__head--assets" role="presentation">
            <span>상태</span>
            <span>모델</span>
            <span>버전</span>
            <span>등록일</span>
            <span>상세</span>
          </div>

          <div className="admin-hub-compact-table__body">
            {pagedAssets.map((asset) => {
              const isExpanded = expandedAssetId === asset.id;

              return (
                <Fragment key={asset.id}>
                  <article
                    className={`admin-hub-compact-row admin-hub-compact-row--assets${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleAssetRow(asset.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleAssetRow(asset.id);
                      }
                    }}
                  >
                    <div className="admin-hub-compact-row__status">
                      <span className={`board-classic-badge ${asset.active ? 'is-success' : 'is-info'}`}>
                        {asset.active ? '활성' : '보관'}
                      </span>
                    </div>
                    <div className="admin-hub-compact-row__title">
                      <strong>{asset.originalFileName}</strong>
                      <span>
                        모델 #{asset.id} · {formatFileSize(asset.size)}
                      </span>
                    </div>
                    <div className="admin-hub-compact-row__meta">{asset.versionLabel ?? '라벨 없음'}</div>
                    <div className="admin-hub-compact-row__date">{formatDateTime(asset.createdAt)}</div>
                    <div className="admin-hub-compact-row__actions admin-action-group admin-action-group--row">
                      <button
                        className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleAssetRow(asset.id);
                        }}
                      >
                        <span>{isExpanded ? '닫기' : '상세'}</span>
                      </button>
                    </div>
                  </article>

                  {isExpanded ? (
                    <section className="admin-hub-compact__inline-detail">
                      <div className="admin-hub-compact__inline-header">
                        <div>
                          <strong>{asset.originalFileName}</strong>
                          <p>{asset.active ? '현재 운영 중인 활성 모델입니다.' : '보관 중인 모델 자산입니다.'}</p>
                        </div>
                        <div className="admin-hub-compact-row__actions admin-hub-compact-row__actions--wrap admin-action-group admin-action-group--inline">
                          {!asset.active && onActivateAsset ? (
                            <button
                              className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button"
                              type="button"
                              disabled={Boolean(updatingAssetId) || uploading}
                              onClick={() => onActivateAsset?.(asset)}
                            >
                              <IconStatus />
                              <span>{updatingAssetId === asset.id ? '적용 중...' : '활성 전환'}</span>
                            </button>
                          ) : null}
                          <button
                            className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button admin-hub-compact__action-btn--danger"
                            type="button"
                            disabled={deletingAssetId === asset.id || Boolean(updatingAssetId) || uploading}
                            onClick={() => onConfirmDeleteAsset(asset)}
                          >
                            <IconDelete />
                            <span>{deletingAssetId === asset.id ? '삭제 중...' : '모델 삭제'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="admin-hub-compact__inline-meta">
                        <span>버전 {asset.versionLabel ?? '라벨 없음'}</span>
                        <span>용량 {formatFileSize(asset.size)}</span>
                        <span>형식 {asset.contentType ?? '미지정'}</span>
                        <span>등록 {formatDateTimeFull(asset.createdAt)}</span>
                        <span>업데이트 {formatDateTimeFull(asset.updatedAt)}</span>
                      </div>

                      <div className="admin-hub-compact__inline-grid">
                          <div className="admin-hub-compact__inline-card">
                            <span>버전 라벨 수정</span>
                            <div className="admin-hub-compact__inline-form">
                              <input
                                type="text"
                              value={assetVersionDrafts?.[asset.id] ?? asset.versionLabel ?? ''}
                              onChange={(event) => onChangeAssetVersionDraft?.(asset.id, event.target.value)}
                                placeholder="예: lite-v2"
                              />
                              <button
                                className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button"
                                type="button"
                              disabled={Boolean(updatingAssetId) || uploading || !onSaveAsset}
                              onClick={() => onSaveAsset?.(asset)}
                              >
                                <IconSave />
                                <span>{updatingAssetId === asset.id ? '저장 중...' : '저장'}</span>
                              </button>
                          </div>
                        </div>
                        <div className="admin-hub-compact__inline-card">
                          <span>저장 경로</span>
                          <strong>{asset.storagePath}</strong>
                        </div>
                        <div className="admin-hub-compact__inline-card">
                          <span>실행 경로</span>
                          <strong>{asset.runtimePath}</strong>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Pagination currentPage={assetPage} totalPages={assetTotalPages} onPageChange={onAssetPageChange} />
    </section>
  );
}

function formatModelOptionLabel(asset: ModelAsset, formatFileSize: (size: number) => string) {
  const versionLabel = asset.versionLabel?.trim() || '라벨 없음';
  const activeSuffix = asset.active ? ' · 활성' : '';
  return `${versionLabel} · ${asset.originalFileName} · ${formatFileSize(asset.size)}${activeSuffix}`;
}
