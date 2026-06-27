/**
 * Common E2E Test Helpers
 * Shared utilities for E2E tests across multiple spec files
 */

import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AuthService } from '../../src/auth';
import { TEST_PASSWORD, TEST_DISPLAY_NAME, ADMIN_EMAIL, ADMIN_DISPLAY_NAME } from './test-constants';

/**
 * Create an admin session for testing
 * @param authService - AuthService instance from the test module
 * @param options - Optional configuration
 * @returns Admin session ID
 */
export async function createAdminSession(
  authService: AuthService,
  options?: {
    email?: string;
    googleId?: string;
    displayName?: string;
  },
): Promise<string> {
  const email = options?.email ?? ADMIN_EMAIL;
  const googleId = options?.googleId ?? `admin-e2e-${Date.now()}`;
  const displayName = options?.displayName ?? ADMIN_DISPLAY_NAME;

  process.env.GOOGLE_ADMIN_EMAILS = email;

  const login = await authService.signInWithGoogle({
    googleId,
    email,
    displayName,
  });

  return authService.createSession(login.user.id);
}

/**
 * Create a normal user session for testing
 * @param authService - AuthService instance from the test module
 * @param options - Optional configuration
 * @returns Object with sessionId, userId, and email
 */
export async function createNormalUserSession(
  authService: AuthService,
  options?: {
    email?: string;
    password?: string;
    displayName?: string;
  },
): Promise<{ sessionId: string; userId: string; email: string }> {
  const email = options?.email ?? `normaluser-${randomUUID()}@test.com`;
  const password = options?.password ?? TEST_PASSWORD;
  const displayName = options?.displayName ?? TEST_DISPLAY_NAME;

  const { user } = await authService.signUpLocal({
    email,
    password,
    displayName,
  });

  const sessionId = await authService.createSession(user.id);

  return { sessionId, userId: user.id, email };
}

/**
 * Sign up a user via HTTP and return user ID and email
 * Useful for E2E tests that use request() directly
 * @param app - NestApplication instance
 * @param options - Optional configuration
 * @returns Object with id and email
 */
export async function createSignedUpUser(
  app: INestApplication,
  options?: {
    email?: string;
    password?: string;
    displayName?: string;
  },
): Promise<{ id: string; email: string }> {
  const email = options?.email ?? `user-${randomUUID()}@example.com`;
  const password = options?.password ?? TEST_PASSWORD;
  const displayName = options?.displayName ?? TEST_DISPLAY_NAME;

  const signUp = await request(app.getHttpServer())
    .post('/auth/signup')
    .send({
      email,
      password,
      displayName,
    });

  if (signUp.status !== 201) {
    throw new Error(
      `Failed to sign up user: ${signUp.status} - ${JSON.stringify(signUp.body)}`,
    );
  }

  return {
    id: signUp.body.user.id as string,
    email,
  };
}
