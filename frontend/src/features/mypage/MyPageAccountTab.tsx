import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { changeAccountPassword, updateAccountProfile, withdrawAccount } from '../../shared/api/authApi';
import { useAuth } from '../../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../../shared/components/CompactConfirmDialog';
import { CompactToast } from '../../shared/components/CompactToast';

type AccountConfirmState = 'none' | 'profile' | 'password' | 'withdraw';

export function MyPageAccountTab() {
  const navigate = useNavigate();
  const { user, logout, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<AccountConfirmState>('none');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isLocalAccount = user?.authProvider === 'LOCAL';

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);
    setConfirmState('profile');
  }

  async function confirmProfileUpdate() {
    setProfileBusy(true);
    setToast(null);

    try {
      await updateAccountProfile({ displayName });
      await refresh();
      setConfirmState('none');
      setToast({ type: 'success', text: '내 정보가 변경되었습니다.' });
    } catch (error) {
      setConfirmState('none');
      setToast({ type: 'error', text: error instanceof Error ? error.message : '내 정보 변경에 실패했습니다.' });
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setToast({ type: 'error', text: '새 비밀번호 확인이 일치하지 않습니다.' });
      return;
    }

    setConfirmState('password');
  }

  async function confirmPasswordChange() {
    setPasswordBusy(true);
    setToast(null);

    try {
      await changeAccountPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setConfirmState('none');
      setToast({ type: 'success', text: '비밀번호가 변경되었습니다.' });
    } catch (error) {
      setConfirmState('none');
      setToast({ type: 'error', text: error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.' });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } finally {
      setLogoutBusy(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawBusy(true);
    setToast(null);

    try {
      await withdrawAccount({ currentPassword: withdrawPassword, confirmed: true });
      await refresh();
      navigate('/', { replace: true });
    } catch (error) {
      setConfirmState('none');
      setToast({ type: 'error', text: error instanceof Error ? error.message : '회원탈퇴 처리에 실패했습니다.' });
    } finally {
      setWithdrawBusy(false);
    }
  }

  const confirmDialog = resolveConfirmDialog(confirmState, profileBusy, passwordBusy, withdrawBusy);

  return (
    <div className="mypage-account-tab">

      <section className="mypage-inline-detail mypage-account-tab__section">
        <div className="board-detail-compact__section-title mypage-account-tab__section-head">
          <strong>내 정보</strong>
          <span>{user?.authProvider ?? 'LOCAL'}</span>
        </div>
        <form className="mypage-inline-form mypage-account-tab__form" onSubmit={handleProfileSubmit}>
          <label className="mypage-inline-field mypage-account-tab__readonly-field">
            <span>이메일</span>
            <strong>{user?.email ?? '-'}</strong>
          </label>
          <label className="mypage-inline-field">
            <span>표시 이름</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={40}
              required
            />
          </label>
          <div className="inline-actions">
            <button className="button-link button-link--compact" type="submit" disabled={profileBusy}>
              {profileBusy ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </section>

      <section className="mypage-inline-detail mypage-account-tab__section">
        <div className="board-detail-compact__section-title mypage-account-tab__section-head">
          <strong>비밀번호 변경</strong>
        </div>
        {isLocalAccount ? (
          <form className="mypage-inline-form mypage-account-tab__form" onSubmit={handlePasswordSubmit}>
            <label className="mypage-inline-field">
              <span>현재 비밀번호</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                required
              />
            </label>
            <label className="mypage-inline-field">
              <span>새 비밀번호</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                minLength={8}
                required
              />
            </label>
            <label className="mypage-inline-field">
              <span>새 비밀번호 확인</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                minLength={8}
                required
              />
            </label>
            <div className="inline-actions">
              <button className="button-link button-link--compact" type="submit" disabled={passwordBusy}>
                {passwordBusy ? '변경 중' : '비밀번호 변경'}
              </button>
            </div>
          </form>
        ) : (
          <p className="mypage-inline-toolbar__note">소셜 로그인 계정은 연결된 서비스에서 비밀번호를 관리합니다.</p>
        )}
      </section>

      <section className="mypage-inline-detail mypage-account-tab__section mypage-account-tab__section--danger">
        <div className="board-detail-compact__section-title mypage-account-tab__section-head">
          <strong>회원탈퇴</strong>
        </div>
        <div className="mypage-account-tab__danger-actions">
          {isLocalAccount ? (
            <label className="mypage-inline-field">
              <span>회원탈퇴 확인 비밀번호</span>
              <input type="password" value={withdrawPassword} onChange={(event) => setWithdrawPassword(event.target.value)} />
            </label>
          ) : null}
          <div className="inline-actions">
            <button
              className="button-link button-link--danger button-link--compact"
              type="button"
              onClick={() => setConfirmState('withdraw')}
              disabled={withdrawBusy || (isLocalAccount && withdrawPassword.trim().length === 0)}
            >
              회원탈퇴
            </button>
          </div>
        </div>
      </section>

      <CompactConfirmDialog
        open={confirmState !== 'none'}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel="취소"
        tone={confirmDialog.tone}
        busy={confirmDialog.busy}
        onConfirm={
          confirmState === 'profile'
            ? confirmProfileUpdate
            : confirmState === 'password'
              ? confirmPasswordChange
              : handleWithdraw
        }
        onCancel={() => setConfirmState('none')}
      />
      <CompactToast
        message={toast?.text ?? null}
        type={toast?.type ?? 'success'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

function resolveConfirmDialog(
  state: AccountConfirmState,
  profileBusy: boolean,
  passwordBusy: boolean,
  withdrawBusy: boolean,
) {
  if (state === 'profile') {
    return {
      title: '내 정보를 저장할까요?',
      description: '표시 이름 변경사항을 계정 정보에 반영합니다.',
      confirmLabel: '저장',
      tone: 'default' as const,
      busy: profileBusy,
    };
  }

  if (state === 'password') {
    return {
      title: '비밀번호를 변경할까요?',
      description: '변경 후 다음 로그인부터 새 비밀번호를 사용합니다.',
      confirmLabel: '변경',
      tone: 'default' as const,
      busy: passwordBusy,
    };
  }

  return {
    title: '회원탈퇴할까요?',
    description: '계정은 즉시 로그아웃되며, 이메일과 이름은 탈퇴회원으로 익명화됩니다.',
    confirmLabel: '회원탈퇴',
    tone: 'danger' as const,
    busy: withdrawBusy,
  };
}
