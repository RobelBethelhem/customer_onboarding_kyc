// API client for fetching data from the backend

const API_BASE = '/api';

export interface Customer {
  _id: string;
  customerId: string;
  fullName: string;
  fullNameAmharic: string;
  email: string;
  phone: string;
  accountType: string;
  accountTypeId: string;
  accountTypeName?: string;
  tierId?: string;
  tierName?: string;
  tierInterestRate?: number;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'auto_approved';
  channel?: 'mobile_app' | 'web' | 'whatsapp' | 'telegram' | 'superapp' | 'other';
  faceVideoId?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  branch: string;
  branchCode: string;
  uin: string;
  fcn: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  region: string;
  zone: string;
  woreda: string;
  kebele?: string;
  houseNumber?: string;
  occupation: string;
  otherOccupation?: string;
  industry: string;
  otherIndustry?: string;
  wealthSource: string;
  otherWealthSource?: string;
  annualIncome: number;
  initialDeposit: number;
  motherMaidenName: string;
  maritalStatus: string;
  marriageCertificatePhoto?: string;
  faydaPhoto: string;
  selfiePhoto?: string;
  verificationPhotos: {
    faceCenter: string;
    eyeBlink: string;
    headLeft: string;
    headRight: string;
    smile: string;
  };
  faceMatchScore: number;
  customerNumber?: string;
  cifNumber?: string;
  accountNumber?: string;
  rejectionReason?: string;
  approvedBy?: string;
  rejectedBy?: string;
  // CIF creation fields
  promotionType?: string;
  customerRiskRating?: string;
  customerSegmentation?: string;
  maintFeeWaived?: string;
  slaEnable?: string;
  leadRm?: string;
  currencyRedemptionPurpose?: string;
  sanctionListStatus?: string;
  taxIdentity?: string;
  politicallyExposedPerson?: string;
  customerType?: string;
  idType?: string;
  nationality?: string;
}

export interface CustomerResponse {
  success: boolean;
  data: Customer[];
  total: number;
  counts: {
    total: number;
    pending: number;
    verified: number;
    approved: number;
    auto_approved: number;
    rejected: number;
  };
}

export interface StatsResponse {
  success: boolean;
  data: {
    counts: {
      total: number;
      pending: number;
      verified: number;
      approved: number;
      auto_approved: number;
      rejected: number;
    };
    todayCounts: {
      total: number;
      pending: number;
      approved: number;
      auto_approved: number;
      rejected: number;
    };
    dailyStats: Array<{
      date: string;
      newAccounts: number;
      pendingReview: number;
      approved: number;
      autoApproved: number;
      rejected: number;
    }>;
    accountTypeStats: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
  };
}

// Fetch all customers with optional filters
export async function fetchCustomers(options?: {
  status?: string;
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<CustomerResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.skip) params.set('skip', options.skip.toString());

  const response = await fetch(`${API_BASE}/customers?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch customers');
  }
  return response.json();
}

// Fetch single customer by ID
export async function fetchCustomer(id: string): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch customer');
  }
  return response.json();
}

// Approve customer
export async function approveCustomer(id: string, approvedBy?: string): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve', approvedBy }),
  });
  if (!response.ok) {
    throw new Error('Failed to approve customer');
  }
  return response.json();
}

// Reject customer
export async function rejectCustomer(
  id: string,
  rejectionReason: string,
  rejectedBy?: string
): Promise<{ success: boolean; data: Customer }> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reject', rejectionReason, rejectedBy }),
  });
  if (!response.ok) {
    throw new Error('Failed to reject customer');
  }
  return response.json();
}

// Fetch stats
export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}

// Helper functions
export function getStatusColor(status: Customer['status']): string {
  const colors: Record<Customer['status'], string> = {
    pending: 'bg-amber-100 text-amber-800',
    verified: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    auto_approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return colors[status];
}

export function getStatusLabel(status: Customer['status']): string {
  const labels: Record<Customer['status'], string> = {
    pending: 'Pending Review',
    verified: 'Verified',
    approved: 'Approved',
    auto_approved: 'Auto Approved',
    rejected: 'Rejected',
  };
  return labels[status];
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  } catch {
    return '-';
  }
}
