/**
 * Test Data Constants
 * Centralized test data for E2E and integration tests
 */

// ─ Auth Test Data ─────────────────────────────────────────────
export const TEST_PASSWORD = 'Secure@99';
export const VALID_PASSWORD = 'Secure@99';
export const WEAK_PASSWORD = 'abc';
export const VALID_EMAIL = 'valid@test.com';
export const INVALID_EMAIL = '1@1';

// ─ Admin Test Data ────────────────────────────────────────────
export const ADMIN_EMAIL = 'admin-e2e@example.com';
export const ADMIN_DISPLAY_NAME = 'Admin E2E';

// ─ Test User Names ────────────────────────────────────────────
export const TEST_DISPLAY_NAME = '일반유저';
export const MENTOR_DISPLAY_NAME = '멘토';
export const MENTEE_DISPLAY_NAME = '멘티';

// ─ Validation Test Data ───────────────────────────────────────
export const VALID_DISPLAY_NAME_MIN = 'AB';
export const VALID_DISPLAY_NAME_MAX = '0123456789012345'; // 16자
export const INVALID_DISPLAY_NAME_SHORT = 'A';
export const INVALID_DISPLAY_NAME_LONG = '01234567890123456'; // 17자

// ─ Test Question Data ─────────────────────────────────────────
export const VALID_QUESTION_SUBJECT = 'MATH';
export const VALID_QUESTION_GRADE = '1';

// ─ Test Reason Data ───────────────────────────────────────────
export const REPORT_REASON = 'spam';
