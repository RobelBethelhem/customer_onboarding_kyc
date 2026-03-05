import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { comparePassword, hashPassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    // Auto-seed: if no users exist, create default admin
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const passwordHash = await hashPassword('Admin@123');
      await User.create({
        email: 'admin@zemenbank.com',
        passwordHash,
        name: 'System Admin',
        role: 'admin',
        isActive: true,
      });
      console.log('[Auth] Auto-seeded default admin: admin@zemenbank.com / Admin@123');
    }

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Sign JWT
    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
