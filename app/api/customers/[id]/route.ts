import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';
import WorkflowSettings, { defaultWorkflowSettings } from '@/lib/models/WorkflowSettings';
import { createCustomerAndAccount, FlexCubeConfig } from '@/lib/flexcube';
import { distributeReferralRewards } from '@/lib/referralRewards';

/**
 * Build FlexCube config from workflow settings
 */
function getFlexCubeConfig(settings: any): FlexCubeConfig {
  return {
    customerServiceUrl: settings?.flexcubeCustomerServiceUrl || 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
    accountServiceUrl: settings?.flexcubeAccountServiceUrl || 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
    userId: settings?.flexcubeUserId || 'FYDA_USR',
    source: settings?.flexcubeSource || 'EXTFYDA',
    defaultBranch: settings?.flexcubeBranch || '103',
    timeout: settings?.flexcubeTimeout || 30000,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const customer = await Customer.findOne({ customerId: params.id }).lean();

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { action, rejectionReason, approvedBy, rejectedBy } = body;

    const customer = await Customer.findOne({ customerId: params.id });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (action === 'approve' || action === 'auto_approve') {
      // ========== LOAD FLEXCUBE SETTINGS ==========
      let settings = await WorkflowSettings.findById('default');
      if (!settings) {
        settings = await WorkflowSettings.create(defaultWorkflowSettings);
      }

      const flexcubeEnabled = settings.flexcubeEnabled !== false;
      const flexcubeConfig = getFlexCubeConfig(settings);

      // Parse name parts
      const nameParts = customer.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';
      const lastName = nameParts[nameParts.length - 1] || '';

      let cifNumber: string | undefined;
      let accountNumber: string | undefined;
      let flexcubeMessage: string = '';

      if (flexcubeEnabled) {
        // ========== REAL FLEXCUBE INTEGRATION ==========
        // Call FlexCube SOAP webservice to create CIF + Account
        console.log(`\n[FlexCube] Starting ${action} for customer: ${customer.fullName} (${customer.customerId})`);

        const result = await createCustomerAndAccount({
          fullName: customer.fullName,
          firstName,
          middleName,
          lastName,
          dateOfBirth: customer.dateOfBirth || '',
          gender: customer.gender === 'female' ? 'F' : 'M',
          phone: customer.phone || '',
          email: customer.email || '',
          motherMaidenName: customer.motherMaidenName || '',
          maritalStatus: customer.maritalStatus || 'S',
          uin: customer.uin || '',
          region: customer.region || '',
          zone: customer.zone || '',
          woreda: customer.woreda || '',
          kebele: customer.kebele || '',
          houseNumber: customer.houseNumber || '',
          occupation: customer.occupation || 'O',
          otherOccupation: customer.otherOccupation || '',
          industry: customer.industry || 'O',
          otherIndustry: customer.otherIndustry || '',
          wealthSource: customer.wealthSource || 'SAL',
          otherWealthSource: customer.otherWealthSource || '',
          annualIncome: customer.annualIncome || 0,
          branchCode: customer.branchCode || flexcubeConfig.defaultBranch,
          accountTypeId: customer.accountTypeId || 'SPRI',
          promotionType: customer.promotionType || 'Walk in customer',
          customerSegmentation: customer.customerSegmentation || 'RETAIL CUSTOMER',
        }, flexcubeConfig);

        if (result.success) {
          cifNumber = result.cifNumber;
          accountNumber = result.accountNumber;
          flexcubeMessage = result.message;
          console.log(`[FlexCube] SUCCESS — CIF: ${cifNumber}, Account: ${accountNumber}`);
        } else {
          // FlexCube failed — return error, do NOT approve without real CIF
          console.error(`[FlexCube] FAILED — ${result.message}`);

          // If CIF was created but account failed, still save the CIF
          if (result.cifNumber) {
            customer.cifNumber = result.cifNumber;
            customer.customerNumber = result.cifNumber;
            await customer.save();
          }

          return NextResponse.json({
            success: false,
            error: `FlexCube integration failed: ${result.message}`,
            cifNumber: result.cifNumber || undefined,
          }, { status: 502 });
        }
      } else {
        // ========== FLEXCUBE DISABLED — FALLBACK LOCAL GENERATION ==========
        console.log(`[FlexCube] DISABLED — using local CIF/Account generation`);

        // Check if customer with same name already exists (reuse CIF)
        const existingCustomer = await Customer.findOne({
          $or: [
            { fullName: customer.fullName },
            {
              $and: [
                { fullName: { $regex: new RegExp(firstName, 'i') } },
                { fullName: { $regex: new RegExp(lastName, 'i') } }
              ]
            },
          ],
          cifNumber: { $exists: true, $nin: [null, ''] },
          _id: { $ne: customer._id }
        }).select('cifNumber fullName');

        if (existingCustomer?.cifNumber) {
          cifNumber = existingCustomer.cifNumber;
          console.log(`[Local] Reusing CIF ${cifNumber} from: ${existingCustomer.fullName}`);
        } else {
          const lastCustomerWithCif = await Customer.findOne({
            cifNumber: { $exists: true, $nin: [null, ''] }
          }).sort({ cifNumber: -1 });

          let nextCifNumber = 1;
          if (lastCustomerWithCif?.cifNumber) {
            const lastCif = parseInt(lastCustomerWithCif.cifNumber, 10);
            nextCifNumber = isNaN(lastCif) ? 1 : lastCif + 1;
          }
          cifNumber = String(nextCifNumber).padStart(7, '0');
          console.log(`[Local] Generated CIF: ${cifNumber}`);
        }

        // Generate account number locally
        const branchCode = customer.branchCode || '016';
        const random2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        const random3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        accountNumber = `${branchCode}${random2}1${cifNumber}${random3}`;
        flexcubeMessage = `Local generation (FlexCube disabled) — CIF: ${cifNumber}, Account: ${accountNumber}`;
      }

      // ========== UPDATE CUSTOMER ==========
      customer.status = action === 'auto_approve' ? 'auto_approved' : 'approved';
      customer.approvedAt = new Date();
      customer.customerNumber = cifNumber;
      customer.cifNumber = cifNumber;
      customer.accountNumber = accountNumber;
      if (approvedBy) customer.approvedBy = approvedBy;

      // ========== LOG ==========
      console.log(`\n========== ACCOUNT CREATED ==========`);
      console.log(`Customer: ${customer.fullName} (${customer.customerId})`);
      console.log(`CIF Number: ${cifNumber}`);
      console.log(`Account Number: ${accountNumber}`);
      console.log(`Branch: ${customer.branch} (${customer.branchCode})`);
      console.log(`Mode: ${action === 'auto_approve' ? 'Auto-Approved' : 'Manual Approval'}`);
      console.log(`FlexCube: ${flexcubeEnabled ? 'ENABLED (real CBS)' : 'DISABLED (local)'}`);
      console.log(`Message: ${flexcubeMessage}`);
      console.log(`====================================\n`);

      // ========== SMS NOTIFICATION (simulated) ==========
      console.log(`[SMS] To: ${customer.phone}`);
      console.log(`[SMS] Dear ${customer.fullName}, your Zemen Bank account has been created!`);
      console.log(`[SMS] CIF: ${cifNumber} | Account: ${accountNumber}`);

      // ========== REFERRAL REWARD DISTRIBUTION ==========
      // If this customer was referred, distribute rewards to the referrer chain
      if (customer.referralCode) {
        try {
          const rewardResult = await distributeReferralRewards(
            customer.customerId,
            cifNumber,
            customer.fullName,
            accountNumber,
          );
          console.log(`[Referral] Manual approval rewards: ${rewardResult.message}`);
        } catch (refError: any) {
          // Don't fail the approval if referral processing fails
          console.error(`[Referral] Error distributing rewards: ${refError.message}`);
        }
      }

    } else if (action === 'reject') {
      customer.status = 'rejected';
      customer.rejectedAt = new Date();
      customer.rejectionReason = rejectionReason || 'No reason provided';
      if (rejectedBy) customer.rejectedBy = rejectedBy;

    } else {
      // General update
      Object.assign(customer, body);
    }

    await customer.save();

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const customer = await Customer.findOneAndDelete({ customerId: params.id });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
