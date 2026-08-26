export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
}

// refreshToken est un jeton opaque (pas un JWT) : le stocker permet une révocation réelle
// côté serveur (logout, rotation), contrairement à un JWT stateless.
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}
