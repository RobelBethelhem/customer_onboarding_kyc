import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const email = request.headers.get('x-user-email');
  const name = request.headers.get('x-user-name');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: { id: userId, email, name, role },
  });
}
