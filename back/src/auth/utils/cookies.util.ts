import { CookieOptions, Response } from 'express';

type CookieConfig = {
  accessTtl: number;
  refreshTtl: number;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
};

const cookieBase = (opts: CookieConfig): CookieOptions => ({
  httpOnly: true,
  sameSite: opts.sameSite,
  secure: opts.secure,
  path: '/',
});

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
  cfg: CookieConfig,
) => {
  res.cookie('access_token', tokens.accessToken, {
    ...cookieBase(cfg),
    maxAge: cfg.accessTtl * 1000,
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    ...cookieBase(cfg),
    maxAge: cfg.refreshTtl * 1000,
  });

  res.cookie('csrf_token', tokens.csrfToken, {
    sameSite: cfg.sameSite,
    secure: cfg.secure,
    httpOnly: false,
    path: '/',
    maxAge: cfg.accessTtl * 1000,
  });
};

export const clearAuthCookies = (res: Response, cfg: CookieConfig) => {
  const common = { sameSite: cfg.sameSite, secure: cfg.secure, path: '/' } as CookieOptions;
  res.clearCookie('access_token', common);
  res.clearCookie('refresh_token', common);
  res.clearCookie('csrf_token', { ...common, httpOnly: false });
};
