'use client';

import { useState } from 'react';
import { deleteAdminUser, banAdminUser, unbanAdminUser, updateAdminUserRole, type AdminUser } from '../lib/api';
import type { UserRole } from '../lib/roles';

const DEFAULT_PROFILE_IMAGE = '/default-profile.svg';

interface BanFormState {
  userId: string | null;
  years: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function AdminUsersPanel({ initialUsers, currentRole }: { initialUsers: AdminUser[]; currentRole: UserRole }) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [banForm, setBanForm] = useState<BanFormState>({
    userId: null,
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [banning, setBanning] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filtered = users.filter((u) => {
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`「${user.displayName}」(${user.email}) 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(user.id);
    setError('');
    try {
      await deleteAdminUser(user.id, currentRole);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '계정 삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  const handleBanClick = (user: AdminUser) => {
    setBanForm({
      userId: user.id,
      years: 0,
      days: 0,
      hours: 1,
      minutes: 0,
      seconds: 0,
    });
  };

  const handleBanSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!banForm.userId) return;

    const user = users.find((u) => u.id === banForm.userId);
    if (!user) return;

    const totalSeconds =
      banForm.years * 365 * 24 * 60 * 60 +
      banForm.days * 24 * 60 * 60 +
      banForm.hours * 60 * 60 +
      banForm.minutes * 60 +
      banForm.seconds;

    if (totalSeconds <= 0) {
      setError('밴 시간을 1초 이상 입력해 주세요.');
      return;
    }

    const now = new Date();
    const banUntilDate = new Date(now);
    banUntilDate.setFullYear(banUntilDate.getFullYear() + banForm.years);
    banUntilDate.setDate(banUntilDate.getDate() + banForm.days);
    banUntilDate.setHours(banUntilDate.getHours() + banForm.hours);
    banUntilDate.setMinutes(banUntilDate.getMinutes() + banForm.minutes);
    banUntilDate.setSeconds(banUntilDate.getSeconds() + banForm.seconds);

    if (!window.confirm(`「${user.displayName}」을(를) ${banUntilDate.toLocaleString('ko-KR')}까지 밴하시겠습니까?`))
      return;

    setBanning(banForm.userId);
    setError('');
    try {
      await banAdminUser(banForm.userId, banUntilDate.toISOString(), currentRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === banForm.userId ? { ...u, banned_until: banUntilDate.toISOString() } : u)),
      );
      setBanForm({
        userId: null,
        years: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '밴 설정에 실패했습니다.');
    } finally {
      setBanning(null);
    }
  };

  const handleUnban = async (user: AdminUser) => {
    if (!window.confirm(`「${user.displayName}」의 밴을 해제하시겠습니까?`)) return;

    setError('');
    try {
      await unbanAdminUser(user.id, currentRole);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, banned_until: null } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '밴 해제에 실패했습니다.');
    }
  };

  const handleUpdateRole = async (user: AdminUser, newRole: 'user' | 'admin') => {
    if (user.role === newRole) return;

    const roleName = newRole === 'admin' ? '관리자' : '일반 사용자';
    if (!window.confirm(`「${user.displayName}」을(를) ${roleName}(으)로 변경하시겠습니까?`)) return;

    setUpdatingRole(user.id);
    setError('');
    try {
      await updateAdminUserRole(user.id, newRole, currentRole);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '역할 변경에 실패했습니다.');
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <div className="stack-list">
      {/* 검색·필터 바 */}
      <div className="admin-users-toolbar">
        <input
          type="search"
          className="search-input admin-users-search"
          placeholder="이름, 이메일, ID로 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-users-filter-pills">
          {(['all', 'user', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              className={`profile-subtab ${filterRole === role ? 'active' : ''}`}
              onClick={() => setFilterRole(role)}
            >
              {role === 'all' ? '전체' : role === 'admin' ? '관리자' : '일반 사용자'}
              <span className="profile-subtab-count">{role === 'all' ? users.length : users.filter((u) => u.role === role).length}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <p style={{ color: '#a21f1f' }}>{error}</p> : null}

      {filtered.length === 0 ? (
        <div className="empty-state">검색 결과가 없습니다.</div>
      ) : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>사용자</th>
                <th>이메일</th>
                <th>역할</th>
                <th>가입일</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
                const bannedUntil = isBanned ? new Date(user.banned_until!) : null;

                return (
                  <tr key={user.id} className={`admin-user-row ${user.role === 'admin' ? 'admin-row' : ''} ${isBanned ? 'banned-row' : ''}`}>
                    <td>
                      <div className="admin-user-name-cell">
                        <img src={user.photoUrl || DEFAULT_PROFILE_IMAGE} alt={user.displayName} className="admin-user-avatar" />
                        <strong>{user.displayName}</strong>
                      </div>
                    </td>
                    <td className="admin-user-email">{user.email}</td>
                    <td>
                      <div className="admin-user-role-selector">
                        <button
                          type="button"
                          className={`community-badge ${user.role === 'admin' ? 'problem' : 'chat'}`}
                          onClick={() => void handleUpdateRole(user, user.role === 'admin' ? 'user' : 'admin')}
                          disabled={updatingRole === user.id}
                          title="클릭하여 역할 변경"
                        >
                          {updatingRole === user.id ? '변경 중…' : user.role === 'admin' ? '관리자' : '사용자'}
                        </button>
                      </div>
                    </td>
                    <td className="admin-user-date">{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td>
                      {isBanned && bannedUntil ? (
                        <span className="admin-user-banned-badge">
                          🔒 {bannedUntil.toLocaleDateString('ko-KR')}까지
                        </span>
                      ) : (
                        <span className="admin-user-normal-badge">정상</span>
                      )}
                    </td>
                    <td className="admin-user-actions">
                      <div className="admin-user-actions-buttons">
                        {isBanned ? (
                          <button
                            type="button"
                            className="admin-user-unban-btn"
                            onClick={() => void handleUnban(user)}
                            aria-label={`${user.displayName} 밴 해제`}
                          >
                            해제
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-user-ban-btn"
                            onClick={() => handleBanClick(user)}
                            aria-label={`${user.displayName} 밴하기`}
                          >
                            밴
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-user-delete-btn"
                          disabled={deleting === user.id}
                          onClick={() => void handleDelete(user)}
                          aria-label={`${user.displayName} 계정 삭제`}
                        >
                          {deleting === user.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {banForm.userId ? (
        <div className="admin-ban-modal-overlay" role="presentation">
          <form className="admin-ban-modal" onSubmit={handleBanSubmit}>
            <h3 className="admin-ban-modal-title">밴 시간 설정</h3>
            <p className="admin-ban-modal-desc">아래 칸에 원하는 시간을 입력하세요.</p>
            <div className="admin-ban-time-grid">
              <label className="admin-ban-time-field">
                <span>#년</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={banForm.years}
                  onChange={(e) => setBanForm((prev) => ({ ...prev, years: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
              <label className="admin-ban-time-field">
                <span>#일</span>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={banForm.days}
                  onChange={(e) => setBanForm((prev) => ({ ...prev, days: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
              <label className="admin-ban-time-field">
                <span>#시</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={banForm.hours}
                  onChange={(e) => setBanForm((prev) => ({ ...prev, hours: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
              <label className="admin-ban-time-field">
                <span>#분</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={banForm.minutes}
                  onChange={(e) => setBanForm((prev) => ({ ...prev, minutes: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
              <label className="admin-ban-time-field">
                <span>#초</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={banForm.seconds}
                  onChange={(e) => setBanForm((prev) => ({ ...prev, seconds: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>
            </div>
            <div className="admin-ban-modal-actions">
              <button type="submit" className="admin-ban-submit" disabled={banning === banForm.userId}>
                {banning === banForm.userId ? '처리 중…' : '밴 적용'}
              </button>
              <button
                type="button"
                className="admin-ban-cancel"
                onClick={() =>
                  setBanForm({
                    userId: null,
                    years: 0,
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                  })
                }
                disabled={banning === banForm.userId}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <p className="card-meta" style={{ textAlign: 'right' }}>
        전체 {users.length}명 · 표시 중 {filtered.length}명
      </p>
    </div>
  );
}
