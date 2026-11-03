export function getLocalAccountFrontendUrl(
  hostname: string,
  configuredFrontend = 'http://localhost:3000',
): string | null {
  if (process.env.NODE_ENV === 'production' || !/^account-[1-9]\d*\.localhost$/.test(hostname)) {
    return null;
  }

  const frontend = new URL(configuredFrontend);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname)) {
    frontend.port = '3000';
  }
  frontend.protocol = 'http:';
  frontend.hostname = hostname;
  return frontend.origin;
}

export function isLocalAccountOrigin(origin: string, configuredFrontend: string): boolean {
  if (!URL.canParse(origin)) {
    return false;
  }
  const url = new URL(origin);
  return origin === url.origin && url.origin === getLocalAccountFrontendUrl(url.hostname, configuredFrontend);
}
