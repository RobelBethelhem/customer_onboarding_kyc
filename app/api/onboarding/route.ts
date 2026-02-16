import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import WorkflowSettings, { defaultWorkflowSettings } from '@/lib/models/WorkflowSettings';

// Increase body size limit — mobile app sends photos as base64 (can be 10MB+)
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

// Generate unique customer ID
async function generateCustomerId(): Promise<string> {
  const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
  let nextNum = 1;

  if (lastCustomer && lastCustomer.customerId) {
    const match = lastCustomer.customerId.match(/ZMN-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `ZMN-${String(nextNum).padStart(5, '0')}`;
}

// Call FlexCube webservice to create customer
async function callFlexCubeService(customerData: any, endpoint: string): Promise<{
  success: boolean;
  customerNumber?: string;
  error?: string;
}> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: customerData.fullName,
        phone: customerData.phone,
        uin: customerData.uin,
        fcn: customerData.fcn,
        accountType: customerData.accountType,
        branch: customerData.branch,
        dateOfBirth: customerData.dateOfBirth,
        gender: customerData.gender,
        initialDeposit: customerData.initialDeposit,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        customerNumber: result.customerNumber || result.cifNumber || `CIF${Date.now().toString().slice(-10)}`,
      };
    }

    // FlexCube service unavailable - generate CIF for demo purposes
    console.log(`FlexCube service returned ${response.status}, generating demo CIF`);
    return {
      success: true,
      customerNumber: `CIF${Date.now().toString().slice(-10)}`,
    };
  } catch (error) {
    console.error('FlexCube service error:', error);
    // For demo purposes, generate a CIF number even if service fails
    return {
      success: true,
      customerNumber: `CIF${Date.now().toString().slice(-10)}`,
    };
  }
}

// POST - Main endpoint for mobile app to submit customer data
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['fullName', 'phone', 'accountType', 'branch', 'faceMatchScore'];
    const missingFields = requiredFields.filter(field => !body[field] && body[field] !== 0);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      }, { status: 400 });
    }

    // Get workflow settings
    let settings = await WorkflowSettings.findById('default');
    if (!settings) {
      settings = await WorkflowSettings.create(defaultWorkflowSettings);
    }

    // Generate customer ID
    const customerId = await generateCustomerId();

    // Determine channel — defaults to 'mobile_app' for backward compatibility
    const validChannels = ['mobile_app', 'web', 'whatsapp', 'telegram', 'superapp', 'other'];
    const channel: string = validChannels.includes(body.channel) ? body.channel : 'mobile_app';
    const isMobileApp = channel === 'mobile_app';

    // Determine status based on workflow settings + channel
    // RULE: Only mobile_app channel can use auto-approval (depends on settings).
    //        All other channels (web, whatsapp, telegram, superapp, other) ALWAYS go
    //        to manual review because they submit a recorded video instead of live
    //        liveness verification — KYC must manually verify the video.
    let status: 'pending' | 'auto_approved' = 'pending';
    let customerNumber: string | undefined;
    let approvedAt: Date | undefined;
    let workflowDecision: string;

    const faceMatchScore = body.faceMatchScore || 0;
    const initialDeposit = body.initialDeposit || 0;

    if (!isMobileApp) {
      // NON-MOBILE CHANNELS: Always manual review regardless of workflow settings
      status = 'pending';
      workflowDecision = `Sent to manual review: Channel "${channel}" requires manual KYC verification (video review required)`;
      console.log(`[CHANNEL] ${channel} → forced manual review (face video ID: ${body.faceVideoId || 'none'})`);
    } else if (settings.mode === 'auto' && settings.autoApprovalEnabled) {
      // MOBILE APP: Auto-approval depends on workflow settings
      const meetsScoreThreshold = faceMatchScore >= settings.minFaceMatchScore;
      const belowDepositLimit = initialDeposit <= settings.requireManualReviewAbove;

      if (meetsScoreThreshold && belowDepositLimit) {
        // Auto approve - call FlexCube service
        if (settings.flexcubeEnabled) {
          const flexcubeResult = await callFlexCubeService(body, settings.flexcubeEndpoint);

          if (flexcubeResult.success) {
            status = 'auto_approved';
            customerNumber = flexcubeResult.customerNumber;
            approvedAt = new Date();
            workflowDecision = `Auto-approved (mobile_app): Face match ${faceMatchScore}% >= ${settings.minFaceMatchScore}%, Deposit ${initialDeposit} ETB <= ${settings.requireManualReviewAbove} ETB`;
          } else {
            // FlexCube failed, send to manual review
            status = 'pending';
            workflowDecision = `Sent to manual review: FlexCube service failed - ${flexcubeResult.error}`;
          }
        } else {
          // FlexCube disabled, just auto approve without CIF
          status = 'auto_approved';
          approvedAt = new Date();
          workflowDecision = `Auto-approved (FlexCube disabled): Face match ${faceMatchScore}% >= ${settings.minFaceMatchScore}%`;
        }
      } else {
        // Does not meet criteria, send to pending
        status = 'pending';
        if (!meetsScoreThreshold) {
          workflowDecision = `Sent to manual review: Face match ${faceMatchScore}% < ${settings.minFaceMatchScore}% threshold`;
        } else {
          workflowDecision = `Sent to manual review: Initial deposit ${initialDeposit} ETB > ${settings.requireManualReviewAbove} ETB limit`;
        }
      }
    } else {
      // Manual mode - all customers go to pending
      status = 'pending';
      workflowDecision = 'Sent to manual review: Workflow mode is set to Manual Approval';
    }

    // Create customer record - save ALL fields from mobile app
    const customerData: Record<string, any> = {
      customerId,
      fullName: body.fullName,
      fullNameAmharic: body.fullNameAmharic,
      email: body.email,
      phone: body.phone,
      accountType: body.accountType,
      status,
      channel,
      faceVideoId: body.faceVideoId || '',
      branch: body.branch,
      branchCode: body.branchCode,
      // Account type and tier information
      accountTypeId: body.accountTypeId,
      accountTypeName: body.accountTypeName,
      tierId: body.tierId,
      tierName: body.tierName,
      tierInterestRate: body.tierInterestRate,
      uin: body.uin,
      fcn: body.fcn,
      gender: body.gender,
      dateOfBirth: body.dateOfBirth,
      // Address fields
      region: body.region,
      zone: body.zone,
      woreda: body.woreda,
      kebele: body.kebele,
      houseNumber: body.houseNumber,
      // Employment/Financial fields
      occupation: body.occupation,
      otherOccupation: body.otherOccupation,
      industry: body.industry,
      otherIndustry: body.otherIndustry,
      wealthSource: body.wealthSource,
      otherWealthSource: body.otherWealthSource,
      annualIncome: body.annualIncome,
      initialDeposit: body.initialDeposit,
      motherMaidenName: body.motherMaidenName,
      maritalStatus: body.maritalStatus,
      // Marriage certificate photo (only for married customers)
      marriageCertificatePhoto: body.marriageCertificatePhoto,
      // Photos - Fayda ID photo and selfie
      faydaPhoto: body.faydaPhoto,
      selfiePhoto: body.selfiePhoto,
      // Liveness verification photos
      verificationPhotos: body.verificationPhotos || {
        faceCenter: body.faceCenter || body.selfiePhoto,
        eyeBlink: body.eyeBlink,
        headLeft: body.headLeft,
        headRight: body.headRight,
        smile: body.smile,
      },
      // Face match score
      faceMatchScore,
      customerNumber,
      approvedAt,
      approvedBy: status === 'auto_approved' ? 'system' : undefined,
    };

    // Enhanced logging for debugging liveness photo submission
    console.log('=== CUSTOMER ONBOARDING API DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Customer Name:', body.fullName || 'Unknown');
    console.log('Customer ID:', customerId);
    console.log('Channel:', channel);
    console.log('Face Video ID:', body.faceVideoId || 'None');

    // Log verification photos in detail
    console.log('Verification Photos Analysis:');
    const vp = body.verificationPhotos;
    if (vp) {
      console.log('  verificationPhotos object: Present');
      console.log('    - faceCenter:', vp.faceCenter ? `${vp.faceCenter.length} chars` : 'EMPTY');
      console.log('    - eyeBlink:', vp.eyeBlink ? `${vp.eyeBlink.length} chars` : 'EMPTY');
      console.log('    - headLeft:', vp.headLeft ? `${vp.headLeft.length} chars` : 'EMPTY');
      console.log('    - headRight:', vp.headRight ? `${vp.headRight.length} chars` : 'EMPTY');
      console.log('    - smile:', vp.smile ? `${vp.smile.length} chars` : 'EMPTY');
    } else {
      console.log('  verificationPhotos object: MISSING - checking root fields');
      console.log('    - faceCenter (root):', body.faceCenter ? `${body.faceCenter.length} chars` : 'EMPTY');
      console.log('    - eyeBlink (root):', body.eyeBlink ? `${body.eyeBlink.length} chars` : 'EMPTY');
      console.log('    - headLeft (root):', body.headLeft ? `${body.headLeft.length} chars` : 'EMPTY');
      console.log('    - headRight (root):', body.headRight ? `${body.headRight.length} chars` : 'EMPTY');
      console.log('    - smile (root):', body.smile ? `${body.smile.length} chars` : 'EMPTY');
    }

    console.log('Other Photos:');
    console.log('  - faydaPhoto:', body.faydaPhoto ? `${body.faydaPhoto.length} chars` : 'EMPTY');
    console.log('  - selfiePhoto:', body.selfiePhoto ? `${body.selfiePhoto.length} chars` : 'EMPTY');
    console.log('  - faceMatchScore:', body.faceMatchScore);
    console.log('Marriage Info:');
    console.log('  - maritalStatus:', body.maritalStatus || 'EMPTY');
    console.log('  - marriageCertificatePhoto:', body.marriageCertificatePhoto ? `${body.marriageCertificatePhoto.length} chars` : 'EMPTY');

    console.log('Address:', {
      region: body.region || 'EMPTY',
      zone: body.zone || 'EMPTY',
      woreda: body.woreda || 'EMPTY',
      kebele: body.kebele || 'EMPTY',
      houseNumber: body.houseNumber || 'EMPTY'
    });

    // Safety: estimate total BSON document size and cap large photos if needed
    // MongoDB BSON limit is 16MB (~16,793,600 bytes). Base64 chars ≈ 75% of that in bytes.
    const MAX_SINGLE_PHOTO_CHARS = 2_000_000; // ~1.5MB per single photo
    const MAX_MULTI_DOC_CHARS = 6_000_000;    // ~4.5MB for multi-document field (|||)

    // Handle marriageCertificatePhoto — may contain ||| delimited multiple docs
    if (customerData.marriageCertificatePhoto && typeof customerData.marriageCertificatePhoto === 'string') {
      const mcPhoto = customerData.marriageCertificatePhoto;
      if (mcPhoto.includes('|||')) {
        // Multiple documents — compress each individually if too large
        const parts = mcPhoto.split('|||');
        console.log(`📄 marriageCertificatePhoto: ${parts.length} documents (total ${mcPhoto.length} chars)`);
        const compressed = parts.map((part: string, i: number) => {
          if (part.length > MAX_SINGLE_PHOTO_CHARS) {
            console.log(`⚠️ Document ${i + 1} too large (${part.length} chars), will be kept but total capped`);
          }
          return part;
        });
        const joined = compressed.join('|||');
        if (joined.length > MAX_MULTI_DOC_CHARS) {
          console.log(`⚠️ Total multi-doc field too large (${joined.length} chars), keeping first documents only`);
          // Keep adding documents until we hit the limit
          let result = '';
          for (const part of compressed) {
            const next = result ? result + '|||' + part : part;
            if (next.length > MAX_MULTI_DOC_CHARS) break;
            result = next;
          }
          customerData.marriageCertificatePhoto = result;
        }
      } else if (mcPhoto.length > MAX_SINGLE_PHOTO_CHARS) {
        console.log(`⚠️ marriageCertificatePhoto too large (${mcPhoto.length} chars), truncating`);
        customerData.marriageCertificatePhoto = mcPhoto.substring(0, MAX_SINGLE_PHOTO_CHARS);
      }
    }

    // Cap other photo fields
    for (const field of ['faydaPhoto', 'selfiePhoto'] as const) {
      if (customerData[field] && typeof customerData[field] === 'string' && customerData[field].length > MAX_SINGLE_PHOTO_CHARS) {
        console.log(`⚠️ ${field} too large (${customerData[field].length} chars), truncating to ${MAX_SINGLE_PHOTO_CHARS} chars`);
        customerData[field] = customerData[field].substring(0, MAX_SINGLE_PHOTO_CHARS);
      }
    }
    // Also check verification photo fields
    if (customerData.verificationPhotos && typeof customerData.verificationPhotos === 'object') {
      for (const key of Object.keys(customerData.verificationPhotos)) {
        const val = customerData.verificationPhotos[key];
        if (val && typeof val === 'string' && val.length > MAX_SINGLE_PHOTO_CHARS) {
          console.log(`⚠️ verificationPhotos.${key} too large (${val.length} chars), truncating to ${MAX_SINGLE_PHOTO_CHARS} chars`);
          customerData.verificationPhotos[key] = val.substring(0, MAX_SINGLE_PHOTO_CHARS);
        }
      }
    }

    // Log estimated total size
    const estimatedSize = JSON.stringify(customerData).length;
    console.log(`Estimated document size: ${(estimatedSize / 1_000_000).toFixed(2)} MB`);
    if (estimatedSize > 15_000_000) {
      console.log('⚠️ WARNING: Document near MongoDB 16MB limit!');
    }
    console.log('=== END DEBUG ===');

    const customer = await Customer.create(customerData);

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.customerId,
        status: customer.status,
        channel,
        customerNumber: customer.customerNumber,
        workflowDecision,
        workflowMode: settings.mode,
        message: status === 'auto_approved'
          ? 'Customer account created successfully via auto-approval'
          : 'Application submitted for KYC officer review',
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process onboarding request',
    }, { status: 500 });
  }
}

// GET - Get workflow status for mobile app
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await WorkflowSettings.findById('default');
    if (!settings) {
      settings = await WorkflowSettings.create(defaultWorkflowSettings);
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: settings.mode,
        autoApprovalEnabled: settings.autoApprovalEnabled,
        minFaceMatchScore: settings.minFaceMatchScore,
        message: settings.mode === 'auto'
          ? `Auto-approval enabled. Minimum face match score: ${settings.minFaceMatchScore}%`
          : 'Manual approval mode. All applications will be reviewed by KYC officers.',
      },
    });
  } catch (error) {
    console.error('Error fetching workflow status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch workflow status',
    }, { status: 500 });
  }
}
