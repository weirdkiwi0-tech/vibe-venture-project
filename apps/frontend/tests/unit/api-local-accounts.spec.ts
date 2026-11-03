/**
 * @jest-environment-options {"url":"http://account-2.localhost:3000"}
 */
import { getApiBaseUrl, getAuthMe, getLogoutUrl } from '../../src/lib/api';

describe('local multi-account API routing', () => {
  beforeEach(() => {
    const env = { ...process.env };
    delete env.NEXT_PUBLIC_API_BASE_URL;
    delete env.NEXT_PUBLIC_API_URL;
    jest.replaceProperty(process, 'env', env);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the account hostname for API requests and logout', async () => {
    expect(getApiBaseUrl()).toBe('http://account-2.localhost:3001');
    expect(getLogoutUrl()).toBe('http://account-2.localhost:3001/auth/logout');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ isAuthenticated: false }),
    });
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    try {
      await getAuthMe();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://account-2.localhost:3001/auth/me',
        expect.objectContaining({ credentials: 'include' }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('retains a configured loopback API port and path', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3101/api';
    expect(getApiBaseUrl()).toBe('http://account-2.localhost:3101/api');
  });

  it('does not rewrite remote API URLs', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('keeps production API routing unchanged', () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });
});
