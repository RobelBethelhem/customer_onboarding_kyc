import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource from '@/lib/models/SanctionSource';
import AuditLog from '@/lib/models/AuditLog';

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

// POST - Import sanctions from JSON (parsed from Excel on client side)
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      entries,
      sourceId,
      sanctionType = 'SANCTIONS',
      importedBy = 'SYSTEM',
      fileName = 'import.xlsx',
    } = body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No entries provided for import',
      }, { status: 400 });
    }

    if (!sourceId) {
      return NextResponse.json({
        success: false,
        error: 'Source ID is required',
      }, { status: 400 });
    }

    const results = {
      total: entries.length,
      success: 0,
      errors: 0,
      skipped: 0,
      errorMessages: [] as string[],
    };

    const batchId = `IMP-${Date.now().toString(36)}`;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Validate required fields
        if (!entry.firstName && !entry.fullName) {
          results.errors++;
          results.errorMessages.push(`Row ${rowNum}: First name or full name is required`);
          continue;
        }

        // Parse full name if only fullName is provided
        let firstName = entry.firstName || '';
        let middleName = entry.middleName || '';
        let lastName = entry.lastName || '';
        let fullName = entry.fullName || '';

        if (fullName && !firstName) {
          const parts = fullName.trim().split(/\s+/);
          firstName = parts[0] || '';
          if (parts.length === 2) {
            lastName = parts[1] || '';
          } else if (parts.length >= 3) {
            middleName = parts[1] || '';
            lastName = parts.slice(2).join(' ');
          }
        }

        if (!firstName || !lastName) {
          results.errors++;
          results.errorMessages.push(`Row ${rowNum}: Could not parse first and last name from "${fullName}"`);
          continue;
        }

        if (!fullName) {
          fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
        }

        // Check for duplicates
        const existing = await SanctionEntry.findOne({
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
          sourceId,
          isDeleted: false,
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create entry
        await SanctionEntry.create({
          firstName,
          middleName,
          lastName,
          fullName,
          fullNameAmharic: entry.fullNameAmharic || '',
          dateOfBirth: entry.dateOfBirth ? new Date(entry.dateOfBirth) : undefined,
          placeOfBirth: entry.placeOfBirth || '',
          nationality: entry.nationality || '',
          gender: entry.gender?.toLowerCase() || 'unknown',
          sanctionType: entry.sanctionType || sanctionType,
          sourceId,
          status: 'ACTIVE',
          reason: entry.reason || '',
          programs: entry.programs ? entry.programs.split(',').map((p: string) => p.trim()) : [],
          remarks: entry.remarks || '',
          pepPosition: entry.pepPosition || '',
          pepCountry: entry.pepCountry || '',
          riskScore: entry.riskScore ? parseInt(entry.riskScore) : 50,
          createdBy: importedBy,
          lastUpdated: new Date(),
          aliases: entry.aliases ? JSON.parse(entry.aliases) : [],
          identifiers: entry.identifiers ? JSON.parse(entry.identifiers) : [],
        });

        results.success++;

      } catch (err: any) {
        results.errors++;
        results.errorMessages.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    // Update source statistics
    await SanctionSource.findOneAndUpdate(
      { sourceId },
      {
        $inc: { totalEntries: results.success, activeEntries: results.success },
        lastImportDate: new Date(),
        lastImportCount: results.success,
      }
    );

    // Create audit log
    await AuditLog.create({
      auditId: generateAuditId(),
      module: 'SANCTIONS',
      action: 'IMPORT',
      entityType: 'SanctionEntry',
      entityId: batchId,
      entityName: `Import from ${fileName}`,
      performedBy: importedBy,
      description: `Imported ${results.success} entries from ${fileName}`,
      importExportDetails: {
        fileName,
        recordCount: results.total,
        successCount: results.success,
        errorCount: results.errors,
        errors: results.errorMessages.slice(0, 50), // Limit errors stored
      },
      batchId,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: `Import completed: ${results.success} added, ${results.skipped} skipped, ${results.errors} errors`,
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to import sanctions entries',
    }, { status: 500 });
  }
}
