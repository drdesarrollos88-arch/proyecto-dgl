import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getCurrentUser } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

