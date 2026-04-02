import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { requireRole } from '@/lib/apiAuth';

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('[Users] List error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'Email, password, name, and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'kyc', 'marketing'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Role must be admin, kyc, or marketing' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Users] Create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
