// =============================================================
// Auth Types (E1-S04)
// =============================================================

export type UserRole =
  | 'public'
  | 'family'
  | 'volunteer'
  | 'ngo'
  | 'law_enforcement'
  | 'admin'

// JWT payload (what we encode into the access token)
export interface JwtPayload {
  sub: string        // userId (UUID)
  email: string
  role: UserRole
  orgId?: string     // organization UUID (optional)
  iat?: number       // issued at (auto-added by jwt.sign)
  exp?: number       // expiry (auto-added by jwt.sign)
}

// Session context available in API routes after auth
export interface AuthContext {
  userId: string
  email: string
  role: UserRole
  orgId?: string
}

// Auth endpoint request/response types

export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  phone?: string
  countryCode?: string
}

export interface RegisterResponse {
  id: string
  email: string
  fullName: string
  role: UserRole
  emailVerified: boolean
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    fullName: string
    role: UserRole
    orgId?: string
    emailVerified: boolean
    mfaEnabled: boolean
  }
  // Present if MFA is required (user not fully authenticated yet)
  mfaRequired?: boolean
  mfaSessionToken?: string
}

export interface MeResponse {
  id: string
  email: string
  fullName: string
  role: UserRole
  orgId?: string
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}
