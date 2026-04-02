import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'zemen-bank-jwt-secret-change-in-production');

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/_next',
  '/favicon.ico',
  '/zblogo',
  '/api/auth/login',
];

// Public API routes (called by web app / mobile app without auth)
function isPublicApiRoute(method: string, pathname: string): boolean {
  if (pathname === '/api/onboarding' && method === 'POST') return true;
  if (pathname === '/api/screening/check' && method === 'POST') return true;
  if (pathname === '/api/referrals/verify' && method === 'POST') return true;
  if (pathname.startsWith('/api/referrals/') && !pathname.startsWith('/api/referrals/config') &&
      !pathname.startsWith('/api/referrals/stats') && !pathname.startsWith('/api/referrals/rewards') &&
      !pathname.startsWith('/api/referrals/convert') && method === 'GET') return true;
  // Allow OPTIONS for CORS preflight
  if (method === 'OPTIONS') return true;
  return false;
}

function checkPageAccess(role: string, path: string): boolean {
  if (role === 'admin') return true;

  if (role === 'kyc') {
    // KYC can access everything except /referrals and /users
    if (path === '/referrals' || path.startsWith('/referrals/')) return false;
    if (path === '/users' || path.startsWith('/users/')) return false;
    return true;
  }

  if (role === 'marketing') {
    // Marketing can ONLY access /referrals and /settings
    if (path === '/referrals' || path.startsWith('/referrals/')) return true;
    if (path === '/settings' || path.startsWith('/settings/')) return true;
    return false;
  }

  return false;
}

function checkApiAccess(role: string, method: string, pathname: string): boolean {
  if (role === 'admin') return true;

  // Auth endpoints are always accessible for authenticated users
  if (pathname.startsWith('/api/auth/')) return true;

  if (role === 'kyc') {
    // KYC can access everything except referral management and user management
    if (pathname.startsWith('/api/referrals')) return false;
    if (pathname.startsWith('/api/users')) return false;
    return true;
  }

  if (role === 'marketing') {
    // Marketing can only access referral endpoints
    if (pathname.startsWith('/api/referrals')) return true;
    return false;
  }

  return false;
}

// Helper: create redirect URL that respects basePath
function createRedirectUrl(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip public API routes
  if (pathname.startsWith('/api/') && isPublicApiRoute(method, pathname)) {
    return NextResponse.next();
  }

  // Get JWT from cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(createRedirectUrl(request, '/login'));
  }

  // Verify JWT
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;
    const userId = payload.userId as string;
    const email = payload.email as string;
    const name = payload.name as string;

    // Page-level role check
    if (!pathname.startsWith('/api/')) {
      if (!checkPageAccess(role, pathname)) {
        // Redirect to appropriate landing page
        if (role === 'marketing') {
          return NextResponse.redirect(createRedirectUrl(request, '/referrals'));
        }
        return NextResponse.redirect(createRedirectUrl(request, '/'));
      }
    }

    // API-level role check
    if (pathname.startsWith('/api/')) {
      if (!checkApiAccess(role, method, pathname)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Pass user info to downstream via headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-email', email || '');
    requestHeaders.set('x-user-name', name || '');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    // Invalid or expired token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const response = NextResponse.redirect(createRedirectUrl(request, '/login'));
    response.cookies.set('auth-token', '', { maxAge: 0, path: '/' });
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|zblogo).*)',
  ],
};
