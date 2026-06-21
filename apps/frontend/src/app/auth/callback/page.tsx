'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 900);

    return () => clearTimeout(timer);
  }, [router]);

  const isNewUser = searchParams.get('newUser') === 'true';
  const message = searchParams.get('message');

  return (
    <div className="page-shell">
      <section className="section-card">
        <div className="section-header">
          <span>Auth</span>
          <h2>{isNewUser ? '회원가입 및 로그인 완료' : '로그인 처리 완료'}</h2>
        </div>
        <p>{message ?? '잠시 후 메인 화면으로 이동합니다.'}</p>
      </section>
    </div>
  );
}
