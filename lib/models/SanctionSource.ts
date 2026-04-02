import mongoose, { Schema, Document } from 'mongoose';

export type SourceType = 'OFAC' | 'UN' | 'EU' | 'LOCAL' | 'PEP' | 'INTERNAL' | 'OTHER';

export interface ISanctionSource extends Document {
  sourceId: string;
  name: string;
  shortName: string;
  type: SourceType;
  description?: string;

  // Source metadata
  country?: string;
  website?: string;
  updateFrequency?: string; // 'DAILY', 'WEEKLY', 'MONTHLY', etc.

  // Status
  isActive: boolean;
  priority: number; // Higher priority sources are checked first

  // Statistics
  totalEntries: number;
  activeEntries: number;
  lastImportDate?: Date;
  lastImportCount?: number;

  // Settings
  autoUpdate: boolean;
  matchingThreshold: number; // 0-100, minimum score to consider a match

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

const SanctionSourceSchema = new Schema<ISanctionSource>({
  sourceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  type: {
    type: String,
    enum: ['OFAC', 'UN', 'EU', 'LOCAL', 'PEP', 'INTERNAL', 'OTHER'],
    required: true,
  },
  description: { type: String },

  country: { type: String },
  website: { type: String },
  updateFrequency: { type: String },

  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 50 },

  totalEntries: { type: Number, default: 0 },
  activeEntries: { type: Number, default: 0 },
  lastImportDate: { type: Date },
  lastImportCount: { type: Number },

  autoUpdate: { type: Boolean, default: false },
  matchingThreshold: { type: Number, default: 80, min: 0, max: 100 },

  createdBy: { type: String },
}, {
  timestamps: true,
});

// Pre-defined sources to seed
export const defaultSources: Partial<ISanctionSource>[] = [
  {
    sourceId: 'OFAC',
    name: 'Office of Foreign Assets Control',
    shortName: 'OFAC',
    type: 'OFAC',
    country: 'USA',
    website: 'https://sanctionssearch.ofac.treas.gov',
    priority: 100,
    matchingThreshold: 85,
  },
  {
    sourceId: 'UN_SC',
    name: 'United Nations Security Council',
    shortName: 'UN',
    type: 'UN',
    website: 'https://www.un.org/securitycouncil/sanctions',
    priority: 95,
    matchingThreshold: 85,
  },
  {
    sourceId: 'EU_SANCTIONS',
    name: 'European Union Sanctions',
    shortName: 'EU',
    type: 'EU',
    website: 'https://www.sanctionsmap.eu',
    priority: 90,
    matchingThreshold: 85,
  },
  {
    sourceId: 'ETH_LOCAL',
    name: 'Ethiopia Local Sanctions List',
    shortName: 'ETH',
    type: 'LOCAL',
    country: 'Ethiopia',
    priority: 100,
    matchingThreshold: 80,
  },
  {
    sourceId: 'PEP_LIST',
    name: 'Politically Exposed Persons',
    shortName: 'PEP',
    type: 'PEP',
    description: 'List of politically exposed persons in Ethiopia and internationally',
    priority: 85,
    matchingThreshold: 75,
  },
  {
    sourceId: 'INTERNAL',
    name: 'Internal Watchlist',
    shortName: 'INT',
    type: 'INTERNAL',
    description: 'Bank internal watchlist for suspicious activities',
    priority: 100,
    matchingThreshold: 90,
  },
];

export default mongoose.models.SanctionSource || mongoose.model<ISanctionSource>('SanctionSource', SanctionSourceSchema);
