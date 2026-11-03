import { getLocalAccountFrontendUrl, isLocalAccountOrigin } from '../../src/local-account-origin';

describe('local account origins', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows only account loopback origins at the configured frontend port', () => {
    expect(isLocalAccountOrigin('http://account-1.localhost:3000', 'http://localhost:3000')).toBe(true);
    expect(isLocalAccountOrigin('http://account-4.localhost:3003', 'http://localhost:3003')).toBe(true);
    for (const origin of [
      'http://account-1.localhost:9999',
      'http://account-1.localhost.evil.example:3000',
      'http://account-1.example.com:3000',
      'http://other.localhost:3000',
      'https://account-1.localhost:3000',
      'null',
      'not-a-url',
      'http://account-1.localhost:3000/path',
    ]) {
      expect(isLocalAccountOrigin(origin, 'http://localhost:3000')).toBe(false);
    }
  });

  it('preserves the account hostname when building logout redirects', () => {
    expect(getLocalAccountFrontendUrl('account-2.localhost')).toBe('http://account-2.localhost:3000');
    expect(getLocalAccountFrontendUrl('account-2.localhost', 'https://frontend.example.com'))
      .toBe('http://account-2.localhost:3000');
    expect(getLocalAccountFrontendUrl('localhost')).toBeNull();
  });

  it('disables account aliases in production', () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production' });
    expect(getLocalAccountFrontendUrl('account-1.localhost')).toBeNull();
    expect(isLocalAccountOrigin('http://account-1.localhost:3000', 'http://localhost:3000')).toBe(false);
  });
});
