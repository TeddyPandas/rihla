import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login');
  const isOnboardingPage = pathname.startsWith('/onboarding');
  const isApiRoute = pathname.startsWith('/api');

  if (isApiRoute) return response;

  if (!user) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  const { data: member } = await supabase
    .from('group_members')
    .select('role, must_change_password')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return response;
  }

  if (member.must_change_password && !isOnboardingPage) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  if (!member.must_change_password && (isAuthPage || isOnboardingPage)) {
    const dest = member.role === 'cheikh' ? '/admin' : '/';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (pathname.startsWith('/admin') && member.role !== 'cheikh') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
