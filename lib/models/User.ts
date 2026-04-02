import mongoose, { Document, Schema, Model } from 'mongoose';

export type UserRole = 'admin' | 'kyc' | 'marketing';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'kyc', 'marketing'], default: 'kyc' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

let User: Model<IUser>;

try {
  User = mongoose.model<IUser>('User');
} catch {
  User = mongoose.model<IUser>('User', UserSchema);
}

export default User;
