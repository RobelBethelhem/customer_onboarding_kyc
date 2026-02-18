import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationPhotos {
  faceCenter?: string;
  eyeBlink?: string;
  headLeft?: string;
  headRight?: string;
  smile?: string;
}

export type CustomerChannel = 'mobile_app' | 'web' | 'whatsapp' | 'telegram' | 'superapp' | 'other';

export interface ICustomer extends Document {
  customerId: string;
  fullName: string;
  fullNameAmharic?: string;
  email?: string;
  phone: string;
  accountType: string;
  accountTypeId?: string;
  accountTypeName?: string;
  tierId?: string;
  tierName?: string;
  tierInterestRate?: number;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'auto_approved';
  channel: CustomerChannel;
  faceVideoId?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  branch: string;
  branchCode?: string;
  uin?: string;
  fcn?: string;
  gender?: 'male' | 'female';
  dateOfBirth?: string;
  region?: string;
  zone?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
  occupation?: string;
  otherOccupation?: string;
  industry?: string;
  otherIndustry?: string;
  wealthSource?: string;
  otherWealthSource?: string;
  annualIncome?: number;
  initialDeposit?: number;
  motherMaidenName?: string;
  maritalStatus?: string;
  marriageCertificatePhoto?: string; // Marriage certificate image for married customers
  faydaPhoto?: string;
  selfiePhoto?: string;
  verificationPhotos?: IVerificationPhotos;
  faceMatchScore: number;
  customerNumber?: string;
  cifNumber?: string;
  accountNumber?: string;
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  // CIF creation fields — sent to FlexCube and stored for reference
  promotionType?: string;            // How customer heard about us (e.g., 'Walk in customer', 'FACEBOOK')
  customerRiskRating?: string;       // KYC risk rating (default: 'LOW')
  customerSegmentation?: string;     // Customer segment (default: 'RETAIL CUSTOMER')
  maintFeeWaived?: string;           // Maintenance fee waived (default: 'Y')
  slaEnable?: string;                // SLA enabled (default: 'N')
  leadRm?: string;                   // Lead RM (default: 'NA')
  currencyRedemptionPurpose?: string; // Currency redemption purpose (default: 'Y')
  sanctionListStatus?: string;       // Is in sanction list (default: 'N')
  taxIdentity?: string;              // Tax Identity Number (TIN)
}

// Default placeholder photo
const placeholderPhoto = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NDc0OGIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBQaG90bzwvdGV4dD48L3N2Zz4=';

const VerificationPhotosSchema = new Schema<IVerificationPhotos>({
  faceCenter: { type: String, default: placeholderPhoto },
  eyeBlink: { type: String, default: placeholderPhoto },
  headLeft: { type: String, default: placeholderPhoto },
  headRight: { type: String, default: placeholderPhoto },
  smile: { type: String, default: placeholderPhoto },
}, { _id: false });

const CustomerSchema = new Schema<ICustomer>({
  customerId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  fullNameAmharic: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, required: true },
  accountType: { type: String, required: true },
  accountTypeId: { type: String, default: '' },
  accountTypeName: { type: String, default: '' },
  tierId: { type: String, default: '' },
  tierName: { type: String, default: '' },
  tierInterestRate: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'rejected', 'auto_approved'],
    default: 'pending'
  },
  channel: {
    type: String,
    enum: ['mobile_app', 'web', 'whatsapp', 'telegram', 'superapp', 'other'],
    default: 'mobile_app'
  },
  faceVideoId: { type: String, default: '' },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  branch: { type: String, required: true },
  branchCode: { type: String, default: '' },
  uin: { type: String, default: '' },
  fcn: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', ''], default: '' },
  dateOfBirth: { type: String, default: '' },
  region: { type: String, default: '' },
  zone: { type: String, default: '' },
  woreda: { type: String, default: '' },
  kebele: { type: String, default: '' },
  houseNumber: { type: String, default: '' },
  occupation: { type: String, default: '' },
  otherOccupation: { type: String, default: '' },
  industry: { type: String, default: '' },
  otherIndustry: { type: String, default: '' },
  wealthSource: { type: String, default: '' },
  otherWealthSource: { type: String, default: '' },
  annualIncome: { type: Number, default: 0 },
  initialDeposit: { type: Number, default: 0 },
  motherMaidenName: { type: String, default: '' },
  maritalStatus: { type: String, default: '' },
  marriageCertificatePhoto: { type: String, default: '' }, // Marriage certificate for married customers
  faydaPhoto: { type: String, default: placeholderPhoto },
  selfiePhoto: { type: String, default: placeholderPhoto },
  verificationPhotos: {
    type: VerificationPhotosSchema,
    default: () => ({
      faceCenter: placeholderPhoto,
      eyeBlink: placeholderPhoto,
      headLeft: placeholderPhoto,
      headRight: placeholderPhoto,
      smile: placeholderPhoto,
    })
  },
  faceMatchScore: { type: Number, default: 0 },
  customerNumber: { type: String },
  cifNumber: { type: String },
  accountNumber: { type: String },
  rejectionReason: { type: String },
  approvedBy: { type: String },
  rejectedBy: { type: String },
  // CIF creation fields — sent to FlexCube and stored for reference
  promotionType: { type: String, default: '' },
  customerRiskRating: { type: String, default: 'LOW' },
  customerSegmentation: { type: String, default: 'RETAIL CUSTOMER' },
  maintFeeWaived: { type: String, default: 'Y' },
  slaEnable: { type: String, default: 'N' },
  leadRm: { type: String, default: 'NA' },
  currencyRedemptionPurpose: { type: String, default: 'Y' },
  sanctionListStatus: { type: String, default: 'N' },
  taxIdentity: { type: String, default: '' },
}, {
  timestamps: true,
});

// Indexes for better query performance
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ createdAt: -1 });
CustomerSchema.index({ branch: 1 });
CustomerSchema.index({ uin: 1 });
CustomerSchema.index({ channel: 1 });

export default mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
