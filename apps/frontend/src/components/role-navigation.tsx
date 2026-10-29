'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { filterNavItems } from '../lib/roles';
import { useAuthUser } from './role-provider';

// Matches the navigation-slide-out duration in globals.css.
const CLOSE_ANIMATION_MS = 240;

export function RoleNavigation() {
  const { authUser } = useAuthUser();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  // Never expose admin navigation unless the authenticated user is actually an admin.
  const role = authUser?.role === 'admin' ? 'admin' : 'user';
  const navItems = filterNavItems(role);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  const closeMenu = () => {
    if (isClosing || !dialogRef.current?.open) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      dialogRef.current?.close();
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
  };

  return (
    <>
      <header className="navigation-topbar">
        <button
          type="button"
          className="navigation-icon-button"
          aria-label="메뉴 열기"
          title="메뉴 열기"
          aria-expanded={isOpen}
          aria-controls={dialogId}
          aria-haspopup="dialog"
          onClick={() => {
            dialogRef.current?.showModal();
            setIsOpen(true);
          }}
        >
          <Menu size={24} aria-hidden="true" />
        </button>
        <Link href="/" className="navigation-brand">KeepIt</Link>
      </header>
      <dialog
        ref={dialogRef}
        id={dialogId}
        className="navigation-dialog"
        aria-label="사이트 메뉴"
        data-closing={isClosing}
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="navigation-drawer">
          <div className="navigation-drawer-header">
            <Link href="/" className="navigation-brand" onClick={closeMenu}>KeepIt</Link>
            <button type="button" className="navigation-icon-button" aria-label="메뉴 닫기" title="메뉴 닫기" onClick={closeMenu}>
              <X size={24} aria-hidden="true" />
            </button>
          </div>
          <nav className="drawer-navigation" aria-label="Primary navigation" data-role={role}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="drawer-navigation-link"
                aria-current={pathname === item.href ? 'page' : undefined}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </>
  );
}