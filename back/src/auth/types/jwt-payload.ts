export type JwtAccessPayload = {
  sub: number;
  email: string;
  role: string;
};

export type JwtRefreshPayload = JwtAccessPayload & {
  jti: string;
};
