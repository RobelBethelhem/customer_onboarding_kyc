/**
 * FlexCube SOAP Web Service Client
 *
 * Integrates with Oracle FlexCube Universal Banking System (FCUBS)
 * for CIF (Customer Information File) creation and Account creation.
 *
 * Flow:
 *   1. CreateCustomer (FCUBSCustomerService) → returns CUSTNO (CIF number)
 *   2. CreateCustAcc  (FCUBSAccService)       → returns ACC (account number)
 *
 * Both calls use the same SOAP envelope structure with FCUBS_HEADER + FCUBS_BODY.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlexCubeConfig {
  /** SOAP endpoint URL for FCUBSCustomerService (CIF creation) */
  customerServiceUrl: string;
  /** SOAP endpoint URL for FCUBSAccService (Account creation) */
  accountServiceUrl: string;
  /** FlexCube user ID (e.g., 'IB_SER') */
  userId: string;
  /** FlexCube source identifier (e.g., 'EXTFYDA' or 'EXTIB') */
  source: string;
  /** Default branch code (e.g., '103') */
  defaultBranch: string;
  /** Timeout in ms for SOAP calls */
  timeout: number;
}

export interface CreateCIFRequest {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;       // YYYY-MM-DD
  gender: string;            // 'M' or 'F'
  phone: string;
  email: string;
  motherMaidenName: string;
  maritalStatus: string;     // 'S', 'M', 'D', 'W'
  nationality: string;       // e.g., 'ET'
  uin: string;               // Fayda UIN (used as SSN)
  // Address
  region: string;
  zone: string;
  woreda: string;
  kebele?: string;
  houseNumber?: string;
  // Employment
  occupation: string;
  industry: string;
  wealthSource: string;
  annualIncome: number;
  // Account opening details
  branchCode: string;
  promotionType?: string;
  customerSegmentation?: string;
}

export interface CreateCIFResult {
  success: boolean;
  cifNumber?: string;       // CUSTNO from FlexCube (e.g., '1154264')
  message: string;
  rawResponse?: string;
}

export interface CreateAccountRequest {
  cifNumber: string;         // CIF from step 1
  customerName: string;
  branchCode: string;
  accountClass: string;      // FlexCube account class (e.g., 'SPRI', 'ZCLUB')
  currency: string;          // 'ETB'
}

export interface CreateAccountResult {
  success: boolean;
  accountNumber?: string;    // ACC from FlexCube (e.g., '1031110039039171')
  cifNumber?: string;
  message: string;
  rawResponse?: string;
}

// ─── Default Configuration ────────────────────────────────────────────────────

export const defaultFlexCubeConfig: FlexCubeConfig = {
  customerServiceUrl: 'http://10.1.245.150:7003/FCUBSCustomerService/FCUBSCustomerService',
  accountServiceUrl: 'http://10.1.245.150:7003/FCUBSAccService/FCUBSAccService',
  userId: 'IB_SER',
  source: 'EXTFYDA',
  defaultBranch: '103',
  timeout: 30000,
};

// ─── Account Class Mapping ────────────────────────────────────────────────────

/**
 * Maps application account type IDs to FlexCube ACCLS (Account Class) codes.
 * This is configured per bank — adjust values to match your FlexCube setup.
 */
const ACCOUNT_CLASS_MAP: Record<string, string> = {
  // Z-Club Special Saving tiers
  'ZCLUB_SPECIAL':  'SPRI',
  'ZCLUB_S_STD':    'SPRI',
  'ZCLUB_S_BSC':    'SPRI',
  'ZCLUB_S_GLD':    'SPRI',
  'ZCLUB_S_PLT':    'SPRI',
  // Z-Club Children Saving
  'ZCLUB_CHILDREN': 'SPRI',
  // Youth Special Saving tiers
  'YOUTH_SPECIAL':  'SPRI',
  'YOUTH_STD':      'SPRI',
  'YOUTH_BSC':      'SPRI',
  'YOUTH_GLD':      'SPRI',
  'YOUTH_EXC':      'SPRI',
};

export function getAccountClass(accountTypeId: string): string {
  return ACCOUNT_CLASS_MAP[accountTypeId] || 'SPRI';
}

// ─── SOAP Envelope Builders ───────────────────────────────────────────────────

function generateMsgId(): string {
  return Date.now().toString();
}

function generateCorrelId(): string {
  return `${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
}

function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build SOAP envelope for CreateCustomer (CIF creation)
 */
function buildCreateCustomerEnvelope(data: CreateCIFRequest, config: FlexCubeConfig): string {
  const msgId = generateMsgId();
  const correlId = generateCorrelId();
  const branch = data.branchCode || config.defaultBranch;
  const shortName = `${data.firstName.substring(0, 5).toUpperCase()}${data.lastName.substring(0, 4).toUpperCase()}`;

  // Determine employment status code for FlexCube
  const empStatMap: Record<string, string> = {
    'EMP': 'E', 'SELF': 'S', 'GOV': 'G', 'STU': 'U', 'RET': 'R', 'O': 'O'
  };
  const empStat = empStatMap[data.occupation] || 'U';

  // Format salary (annual income / 12 for monthly)
  const monthlySalary = Math.round((data.annualIncome || 0) / 12);

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:CREATECUSTOMER_FSFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:MSGID>${msgId}</fcub:MSGID>
            <fcub:CORRELID>${correlId}</fcub:CORRELID>
            <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
            <fcub:BRANCH>${escapeXml(branch)}</fcub:BRANCH>
            <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
            <fcub:OPERATION>CreateCustomer</fcub:OPERATION>
            <fcub:SOURCE_OPERATION>CreateCustomer</fcub:SOURCE_OPERATION>
            <fcub:ACTION>NEW</fcub:ACTION>
            <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Customer-Full>
                    <fcub:CTYPE>I</fcub:CTYPE>
                    <fcub:NAME>${escapeXml(data.fullName.toUpperCase())}</fcub:NAME>
                    <fcub:ADDRLN1>${escapeXml(data.region.toUpperCase())}</fcub:ADDRLN1>
                    <fcub:ADDRLN2>${escapeXml(data.zone.toUpperCase())}</fcub:ADDRLN2>
                    <fcub:ADDRLN3>${escapeXml(data.woreda.toUpperCase())}</fcub:ADDRLN3>
                    <fcub:ADDRLN4>${escapeXml((data.houseNumber || '').toUpperCase())}</fcub:ADDRLN4>
                    <fcub:COUNTRY>ET</fcub:COUNTRY>
                    <fcub:SNAME>${escapeXml(shortName)}</fcub:SNAME>
                    <fcub:NLTY>ET</fcub:NLTY>
                    <fcub:CCATEG>INDI</fcub:CCATEG>
                    <fcub:FULLNAME>${escapeXml(data.fullName.toUpperCase())}</fcub:FULLNAME>
                    <fcub:MEDIA>MAIL</fcub:MEDIA>
                    <fcub:LOC>CIF</fcub:LOC>
                    <fcub:SSN>${escapeXml(data.uin)}</fcub:SSN>
                     <fcub:Custpersonal>
                        <fcub:FSTNAME>${escapeXml(data.firstName.toUpperCase())}</fcub:FSTNAME>
                        <fcub:MIDNAME>${escapeXml(data.middleName.toUpperCase())}</fcub:MIDNAME>
                        <fcub:LSTNAME>${escapeXml(data.lastName.toUpperCase())}</fcub:LSTNAME>
                        <fcub:DOB>${escapeXml(data.dateOfBirth)}</fcub:DOB>
                        <fcub:GENDR>${data.gender === 'F' ? 'F' : 'M'}</fcub:GENDR>
                        <fcub:TELEPHNO>${escapeXml(data.phone)}</fcub:TELEPHNO>
                        <fcub:EMAILID>${escapeXml((data.email || '').toUpperCase())}</fcub:EMAILID>
                        <fcub:MOBNUM>${escapeXml(data.phone)}</fcub:MOBNUM>
                        <fcub:MINOR>N</fcub:MINOR>
                        <fcub:PLACEOFBIRTH>ADDIS ABABA</fcub:PLACEOFBIRTH>
                        <fcub:MOTHERMAIDN_NAME>${escapeXml((data.motherMaidenName || '').toUpperCase())}</fcub:MOTHERMAIDN_NAME>
                        <fcub:BENEFADDR1>${escapeXml(data.zone.toUpperCase())}</fcub:BENEFADDR1>
                        <fcub:BENEFADDR2>${escapeXml(data.woreda.toUpperCase())}</fcub:BENEFADDR2>
                        <fcub:ADDRS3>${escapeXml(data.woreda.toUpperCase())}</fcub:ADDRS3>
                        <fcub:ADDRS4>${escapeXml((data.houseNumber || '').toUpperCase())}</fcub:ADDRS4>
                        <fcub:LANG>ENG</fcub:LANG>
                        <fcub:Custdomestic>
                        <fcub:MARITALSTAT>${escapeXml(data.maritalStatus || 'S')}</fcub:MARITALSTAT>
                        </fcub:Custdomestic>
                        <fcub:Custprof>
                        <fcub:EMPSTAT>${empStat}</fcub:EMPSTAT>
                        <fcub:AMTCCY1>ETB</fcub:AMTCCY1>
                         <fcub:SALARY>${monthlySalary}</fcub:SALARY>
                         <fcub:SALARY_FREQ>M</fcub:SALARY_FREQ>
                        </fcub:Custprof>
                    </fcub:Custpersonal>
                   <fcub:UDFDETAILS>
                        <fcub:FLDNAM>MAINT_FEE_WAIVED</fcub:FLDNAM>
                        <fcub:FLDVAL>Y</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                   <fcub:UDFDETAILS>
                        <fcub:FLDNAM>PROMOTION_TYPE</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.promotionType || 'MAPP')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                   <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CUSTOMER_SEGMENTATION</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.customerSegmentation || 'RETAIL CUSTOMER')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                   <fcub:UDFDETAILS>
                        <fcub:FLDNAM>WEALTH_SOURCE</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.wealthSource || 'SAL')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>OCCUPATION</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.occupation || 'O')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>INDUSTRY</fcub:FLDNAM>
                        <fcub:FLDVAL>${escapeXml(data.industry || 'O')}</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CUSTOMER_RISK_RATING</fcub:FLDNAM>
                        <fcub:FLDVAL>LOW</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>IS_THE_CUSTOMER_IN_SANCTION_LIST</fcub:FLDNAM>
                        <fcub:FLDVAL>N</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>CURRENCY_REDEMPTION_PURPOSE</fcub:FLDNAM>
                        <fcub:FLDVAL>Y</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>SLA_ENABLE</fcub:FLDNAM>
                        <fcub:FLDVAL>N</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
                    <fcub:UDFDETAILS>
                        <fcub:FLDNAM>LEAD_RM</fcub:FLDNAM>
                        <fcub:FLDVAL>NA</fcub:FLDVAL>
                    </fcub:UDFDETAILS>
            </fcub:Customer-Full>
         </fcub:FCUBS_BODY>
      </fcub:CREATECUSTOMER_FSFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Build SOAP envelope for CreateCustAcc (Account creation)
 */
function buildCreateAccountEnvelope(data: CreateAccountRequest, config: FlexCubeConfig): string {
  const correlId = generateCorrelId();
  const branch = data.branchCode || config.defaultBranch;

  // Account number template: BRN + 111 + XXXXXXXXXX (FlexCube will generate the full number)
  const accTemplate = `${branch}111XXXXXXXXXX`;

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSAccService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:CREATECUSTACC_FSFS_REQ>
         <fcub:FCUBS_HEADER>
                <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
                <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
                <fcub:CORRELID>${correlId}</fcub:CORRELID>
                <fcub:BRANCH>${escapeXml(branch)}</fcub:BRANCH>
                <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
                <fcub:MODULEID>ST</fcub:MODULEID>
                <fcub:SERVICE>FCUBSAccService</fcub:SERVICE>
                <fcub:OPERATION>CreateCustAcc</fcub:OPERATION>
                <fcub:ACTION>NEW</fcub:ACTION>
                <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Cust-Account-Full>
                    <fcub:BRN>${escapeXml(branch)}</fcub:BRN>
                    <fcub:ACC>${escapeXml(accTemplate)}</fcub:ACC>
                    <fcub:CUSTNAME>${escapeXml(data.customerName.toUpperCase())}</fcub:CUSTNAME>
                    <fcub:CUSTNO>${escapeXml(data.cifNumber)}</fcub:CUSTNO>
                    <fcub:ACCLS>${escapeXml(data.accountClass)}</fcub:ACCLS>
                    <fcub:CCY>${escapeXml(data.currency || 'ETB')}</fcub:CCY>
                    <fcub:LOC>CIF</fcub:LOC>
                    <fcub:MEDIA>MAIL</fcub:MEDIA>
                    <fcub:CustAcc>
                    <fcub:Misdetails>
                       <fcub:POOLCD>ACT_OPEN</fcub:POOLCD>
                    </fcub:Misdetails>
                    </fcub:CustAcc>
            </fcub:Cust-Account-Full>
         </fcub:FCUBS_BODY>
      </fcub:CREATECUSTACC_FSFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Build SOAP envelope for QueryCustomer (check existing CIF by SSN/UIN)
 */
function buildQueryCustomerBySSNEnvelope(uin: string, config: FlexCubeConfig): string {
  const msgId = generateMsgId();
  const correlId = generateCorrelId();

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
   <soapenv:Header/>
   <soapenv:Body>
      <fcub:QUERYCUSTOMER_IOFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>${escapeXml(config.source)}</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:MSGID>${msgId}</fcub:MSGID>
            <fcub:CORRELID>${correlId}</fcub:CORRELID>
            <fcub:USERID>${escapeXml(config.userId)}</fcub:USERID>
            <fcub:BRANCH>${escapeXml(config.defaultBranch)}</fcub:BRANCH>
            <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
            <fcub:OPERATION>QueryCustomer</fcub:OPERATION>
            <fcub:SOURCE_OPERATION>QueryCustomer</fcub:SOURCE_OPERATION>
            <fcub:MSGSTAT>SUCCESS</fcub:MSGSTAT>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Customer-IO>
               <fcub:SSN>${escapeXml(uin)}</fcub:SSN>
            </fcub:Customer-IO>
         </fcub:FCUBS_BODY>
      </fcub:QUERYCUSTOMER_IOFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`;
}

// ─── SOAP Response Parsers ────────────────────────────────────────────────────

/**
 * Extract a tag value from XML response (simple regex-based parser)
 * Works for FlexCube SOAP responses without requiring a full XML parser
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Match both namespaced and non-namespaced tags
  const patterns = [
    new RegExp(`<(?:[a-zA-Z]+:)?${tagName}>([^<]*)<\/(?:[a-zA-Z]+:)?${tagName}>`, 'i'),
    new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i'),
  ];
  for (const regex of patterns) {
    const match = xml.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Check if the SOAP response indicates success
 */
function isSuccessResponse(xml: string): boolean {
  const msgStat = extractXmlValue(xml, 'MSGSTAT');
  return msgStat?.toUpperCase() === 'SUCCESS';
}

/**
 * Extract error details from failed SOAP response
 */
function extractErrorFromResponse(xml: string): string {
  const ecode = extractXmlValue(xml, 'ECODE');
  const edesc = extractXmlValue(xml, 'EDESC');
  if (ecode && edesc) {
    return `${ecode}: ${edesc}`;
  }
  if (edesc) return edesc;

  // Check for WCODE/WDESC (warnings that may contain error info)
  const wcode = extractXmlValue(xml, 'WCODE');
  const wdesc = extractXmlValue(xml, 'WDESC');
  if (wcode && wdesc) return `${wcode}: ${wdesc}`;

  return 'Unknown FlexCube error';
}

// ─── SOAP HTTP Caller ─────────────────────────────────────────────────────────

async function callSoapService(url: string, soapEnvelope: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[FlexCube SOAP] Calling: ${url}`);
    console.log(`[FlexCube SOAP] Request length: ${soapEnvelope.length} chars`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '',
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log(`[FlexCube SOAP] Response status: ${response.status}`);
    console.log(`[FlexCube SOAP] Response length: ${responseText.length} chars`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 500)}`);
    }

    return responseText;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`FlexCube SOAP timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Query FlexCube to check if a customer already exists by Fayda UIN (SSN).
 * Returns the CIF number if found, null otherwise.
 */
export async function queryCustomerByUIN(
  uin: string,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<string | null> {
  try {
    if (!uin) return null;

    const envelope = buildQueryCustomerBySSNEnvelope(uin, config);
    const response = await callSoapService(config.customerServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (custNo && custNo !== 'null') {
        console.log(`[FlexCube] Found existing CIF by UIN ${uin}: ${custNo}`);
        return custNo;
      }
    }

    return null;
  } catch (error) {
    console.log(`[FlexCube] QueryCustomer by UIN failed (customer may not exist): ${error}`);
    return null;
  }
}

/**
 * Step 1: Create CIF (Customer Information File) in FlexCube
 * Calls FCUBSCustomerService → CreateCustomer
 */
export async function createCIF(
  data: CreateCIFRequest,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<CreateCIFResult> {
  try {
    console.log(`\n========== FLEXCUBE: CREATE CIF ==========`);
    console.log(`Customer: ${data.fullName}`);
    console.log(`Branch: ${data.branchCode}`);
    console.log(`UIN: ${data.uin}`);

    // Step 0: Check if customer already exists by UIN (Fayda ID)
    const existingCif = await queryCustomerByUIN(data.uin, config);
    if (existingCif) {
      console.log(`[FlexCube] Customer already exists in CBS with CIF: ${existingCif}`);
      return {
        success: true,
        cifNumber: existingCif,
        message: `Customer already exists in FlexCube with CIF: ${existingCif}`,
      };
    }

    // Step 1: Build and send CIF creation SOAP request
    const envelope = buildCreateCustomerEnvelope(data, config);
    const response = await callSoapService(config.customerServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (custNo) {
        console.log(`[FlexCube] CIF created successfully: ${custNo}`);
        console.log(`==========================================\n`);
        return {
          success: true,
          cifNumber: custNo,
          message: `CIF ${custNo} created successfully in FlexCube`,
          rawResponse: response,
        };
      }
    }

    // Parse error
    const errorMsg = extractErrorFromResponse(response);
    console.error(`[FlexCube] CIF creation failed: ${errorMsg}`);
    console.log(`==========================================\n`);
    return {
      success: false,
      message: `FlexCube CIF creation failed: ${errorMsg}`,
      rawResponse: response,
    };

  } catch (error: any) {
    console.error(`[FlexCube] CIF creation error:`, error.message);
    return {
      success: false,
      message: `FlexCube connection error: ${error.message}`,
    };
  }
}

/**
 * Step 2: Create Account in FlexCube using the CIF from step 1
 * Calls FCUBSAccService → CreateCustAcc
 */
export async function createAccount(
  data: CreateAccountRequest,
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<CreateAccountResult> {
  try {
    console.log(`\n========== FLEXCUBE: CREATE ACCOUNT ==========`);
    console.log(`CIF: ${data.cifNumber}`);
    console.log(`Customer: ${data.customerName}`);
    console.log(`Branch: ${data.branchCode}`);
    console.log(`Account Class: ${data.accountClass}`);

    const envelope = buildCreateAccountEnvelope(data, config);
    const response = await callSoapService(config.accountServiceUrl, envelope, config.timeout);

    if (isSuccessResponse(response)) {
      const accNo = extractXmlValue(response, 'ACC');
      const custNo = extractXmlValue(response, 'CUSTNO');
      if (accNo && !accNo.includes('XXXXXXXXXX')) {
        console.log(`[FlexCube] Account created successfully: ${accNo}`);
        console.log(`=============================================\n`);
        return {
          success: true,
          accountNumber: accNo,
          cifNumber: custNo || data.cifNumber,
          message: `Account ${accNo} created successfully in FlexCube`,
          rawResponse: response,
        };
      }
    }

    // Parse error
    const errorMsg = extractErrorFromResponse(response);
    console.error(`[FlexCube] Account creation failed: ${errorMsg}`);
    console.log(`=============================================\n`);
    return {
      success: false,
      message: `FlexCube account creation failed: ${errorMsg}`,
      rawResponse: response,
    };

  } catch (error: any) {
    console.error(`[FlexCube] Account creation error:`, error.message);
    return {
      success: false,
      message: `FlexCube connection error: ${error.message}`,
    };
  }
}

/**
 * Full flow: Create CIF + Create Account in FlexCube
 * This is the main function called during approval.
 *
 * Returns both CIF number and Account number on success.
 */
export async function createCustomerAndAccount(
  customerData: {
    fullName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    email: string;
    motherMaidenName: string;
    maritalStatus: string;
    uin: string;
    region: string;
    zone: string;
    woreda: string;
    kebele?: string;
    houseNumber?: string;
    occupation: string;
    industry: string;
    wealthSource: string;
    annualIncome: number;
    branchCode: string;
    accountTypeId: string;
    promotionType?: string;
    customerSegmentation?: string;
  },
  config: FlexCubeConfig = defaultFlexCubeConfig
): Promise<{
  success: boolean;
  cifNumber?: string;
  accountNumber?: string;
  message: string;
}> {
  // ── Step 1: Create CIF ──
  const cifResult = await createCIF({
    ...customerData,
    nationality: 'ET',
  }, config);

  if (!cifResult.success || !cifResult.cifNumber) {
    return {
      success: false,
      message: `CIF creation failed: ${cifResult.message}`,
    };
  }

  // ── Step 2: Create Account using CIF ──
  const accountClass = getAccountClass(customerData.accountTypeId);
  const accountResult = await createAccount({
    cifNumber: cifResult.cifNumber,
    customerName: customerData.fullName,
    branchCode: customerData.branchCode || config.defaultBranch,
    accountClass,
    currency: 'ETB',
  }, config);

  if (!accountResult.success || !accountResult.accountNumber) {
    return {
      success: false,
      cifNumber: cifResult.cifNumber,
      message: `CIF ${cifResult.cifNumber} created but account creation failed: ${accountResult.message}`,
    };
  }

  return {
    success: true,
    cifNumber: cifResult.cifNumber,
    accountNumber: accountResult.accountNumber,
    message: `Customer created in FlexCube — CIF: ${cifResult.cifNumber}, Account: ${accountResult.accountNumber}`,
  };
}
