import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { requireRole } from '@/lib/apiAuth';

// PATCH /api/users/[id] - Update user (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const { id } = params;
    const body = await request.json();
    const { name, role, isActive, password } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (name) user.name = name;
    if (role && ['admin', 'kyc', 'marketing'].includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (password && password.length >= 6) {
      user.passwordHash = await hashPassword(password);
    }

    await user.save();

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Users] Update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Deactivate user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = requireRole(request, ['admin']);
  if (denied) return denied;

  try {
    await connectToDatabase();

    const { id } = params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    user.isActive = false;
    await user.save();

    return NextResponse.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    console.error('[Users] Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
