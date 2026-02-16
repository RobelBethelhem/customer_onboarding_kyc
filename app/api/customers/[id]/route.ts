import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

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

    if (action === 'approve') {
      // ========== CIF GENERATION ==========
      // Check if customer with same name already exists (reuse CIF if found)
      const nameParts = customer.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

      // Search for existing customer by name match
      const existingCustomer = await Customer.findOne({
        $or: [
          { fullName: customer.fullName },
          {
            $and: [
              { fullName: { $regex: new RegExp(firstName, 'i') } },
              { fullName: { $regex: new RegExp(lastName, 'i') } }
            ]
          },
          ...(middleName ? [{ fullName: { $regex: new RegExp(middleName, 'i') } }] : [])
        ],
        cifNumber: { $exists: true, $ne: null, $ne: '' },
        _id: { $ne: customer._id }
      }).select('cifNumber fullName');

      let cifNumber: string;
      if (existingCustomer) {
        // Reuse existing CIF
        cifNumber = existingCustomer.cifNumber!;
        console.log(`[CIF] Reusing CIF ${cifNumber} from existing customer: ${existingCustomer.fullName}`);
      } else {
        // Generate new 7-digit CIF (sequential)
        const lastCustomerWithCif = await Customer.findOne({
          cifNumber: { $exists: true, $ne: null, $ne: '' }
        }).sort({ cifNumber: -1 });

        let nextCifNumber = 1;
        if (lastCustomerWithCif?.cifNumber) {
          // Extract numeric part and increment
          const lastCif = parseInt(lastCustomerWithCif.cifNumber, 10);
          nextCifNumber = isNaN(lastCif) ? 1 : lastCif + 1;
        }
        cifNumber = String(nextCifNumber).padStart(7, '0');
        console.log(`[CIF] Generated new CIF: ${cifNumber}`);
      }

      // ========== ACCOUNT NUMBER GENERATION ==========
      // Format: [BranchCode][Random 2 digits][1][7-digit CIF][Random 3 digits]
      // Example: 031 + 45 + 1 + 0000001 + 789 = 03145100000017890
      const branchCode = customer.branchCode || '016';
      const random2Digits = String(Math.floor(Math.random() * 100)).padStart(2, '0');
      const fixedDigit = '1';
      const random3Digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const accountNumber = `${branchCode}${random2Digits}${fixedDigit}${cifNumber}${random3Digits}`;

      console.log(`[Account] Generated account number: ${accountNumber}`);
      console.log(`  - Branch Code: ${branchCode}`);
      console.log(`  - Random 2 Digits: ${random2Digits}`);
      console.log(`  - Fixed Digit: ${fixedDigit}`);
      console.log(`  - CIF: ${cifNumber}`);
      console.log(`  - Random 3 Digits: ${random3Digits}`);

      // ========== UPDATE CUSTOMER ==========
      customer.status = 'approved';
      customer.approvedAt = new Date();
      customer.customerNumber = `CIF${cifNumber}`; // Legacy field
      customer.cifNumber = cifNumber;
      customer.accountNumber = accountNumber;
      if (approvedBy) customer.approvedBy = approvedBy;

      // ========== SMS SIMULATION ==========
      console.log(`\n========== SMS SIMULATION ==========`);
      console.log(`To: ${customer.phone}`);
      console.log(`Message: Dear ${customer.fullName}, your Zemen Bank account has been created successfully!`);
      console.log(`  CIF Number: ${cifNumber}`);
      console.log(`  Account Number: ${accountNumber}`);
      console.log(`  Branch: ${customer.branch} (${branchCode})`);
      console.log(`Welcome to Zemen Bank!`);
      console.log(`====================================\n`);

    } else if (action === 'reject') {
      customer.status = 'rejected';
      customer.rejectedAt = new Date();
      customer.rejectionReason = rejectionReason || 'No reason provided';
      if (rejectedBy) customer.rejectedBy = rejectedBy;

    } else if (action === 'auto_approve') {
      // Use same CIF and account generation logic as approve
      const nameParts = customer.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

      const existingCustomer = await Customer.findOne({
        $or: [
          { fullName: customer.fullName },
          {
            $and: [
              { fullName: { $regex: new RegExp(firstName, 'i') } },
              { fullName: { $regex: new RegExp(lastName, 'i') } }
            ]
          },
          ...(middleName ? [{ fullName: { $regex: new RegExp(middleName, 'i') } }] : [])
        ],
        cifNumber: { $exists: true, $ne: null, $ne: '' },
        _id: { $ne: customer._id }
      }).select('cifNumber fullName');

      let cifNumber: string;
      if (existingCustomer) {
        cifNumber = existingCustomer.cifNumber!;
        console.log(`[Auto-Approve CIF] Reusing CIF ${cifNumber} from existing customer: ${existingCustomer.fullName}`);
      } else {
        const lastCustomerWithCif = await Customer.findOne({
          cifNumber: { $exists: true, $ne: null, $ne: '' }
        }).sort({ cifNumber: -1 });

        let nextCifNumber = 1;
        if (lastCustomerWithCif?.cifNumber) {
          const lastCif = parseInt(lastCustomerWithCif.cifNumber, 10);
          nextCifNumber = isNaN(lastCif) ? 1 : lastCif + 1;
        }
        cifNumber = String(nextCifNumber).padStart(7, '0');
        console.log(`[Auto-Approve CIF] Generated new CIF: ${cifNumber}`);
      }

      const branchCode = customer.branchCode || '016';
      const random2Digits = String(Math.floor(Math.random() * 100)).padStart(2, '0');
      const fixedDigit = '1';
      const random3Digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const accountNumber = `${branchCode}${random2Digits}${fixedDigit}${cifNumber}${random3Digits}`;

      customer.status = 'auto_approved';
      customer.approvedAt = new Date();
      customer.customerNumber = `CIF${cifNumber}`;
      customer.cifNumber = cifNumber;
      customer.accountNumber = accountNumber;

      console.log(`[Auto-Approve] Account created - CIF: ${cifNumber}, Account: ${accountNumber}`);

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
