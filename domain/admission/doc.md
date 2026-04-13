# Admission System Documentation

## 1️⃣ Models

### Admission Models

#### **AdmissionApplication**
```javascript
{
  applicantId: ObjectId,        // ref: "Applicant" (required)
  admissionCycleId: ObjectId,   // ref: "AdmissionCycle" (required)
  programmeId: ObjectId,        // ref: "Programme" (required)
  departmentId: ObjectId,       // ref: "Department" (required)
  status: String,               // enum: ["draft", "submitted", "underReview", 
                                //         "postUTMEScheduled", "postUTMEScoreReceived",
                                //         "aggregateCalculated", "admitted", 
                                //         "rejected", "waitlisted"]
  score: Number,                // Aggregate score
  submittedAt: Date,            // When application was submitted
  metadata: Mixed               // Flexible storage for schedule, scores, letters
}
```

#### **AdmissionDocument**
```javascript
{
  admissionApplicationId: ObjectId,  // ref: "AdmissionApplication" (required)
  category: String,                  // enum: ["jambResult", "oLevelResult", 
                                     //        "birthCertificate", "referenceLetter",
                                     //        "localGovernmentIdentification",
                                     //        "passportPhotograph", "postUTMEResult"]
  status: String,                    // enum: ["notStarted", "uploaded", 
                                     //        "underReview", "verified", "rejected"]
  fileId: ObjectId,                  // ref: "File"
  uploadedAt: Date,
  verifiedAt: Date,
  verifiedBy: ObjectId,              // ref: "User"
  rejectionReason: String,           // enum: ["blurry", "incomplete", "expired", 
                                     //        "fake", "wrongDocument", "other"]
  rejectionNotes: String,            // maxlength: 500
  verificationScore: Number,         // min: 0, max: 1
  metadata: Map,                     // Flexible key-value storage
  uploadAttempts: Number,           // default: 0
  lastUploadedAt: Date
}
```

#### **AdmissionDecision**
```javascript
{
  admissionApplicationId: ObjectId,  // ref: "AdmissionApplication" (required)
  decision: String,                  // enum: ["admitted", "rejected", "waitlisted"] (required)
  decidedBy: ObjectId,               // ref: "User" (required)
  notes: String,
  decisionDate: Date                 // default: Date.now
}
```

#### **AdmissionAcceptance**
```javascript
{
  admissionApplicationId: ObjectId,  // ref: "AdmissionApplication" (required, unique)
  accepted: Boolean,                 // (required)
  acceptedAt: Date
}
```

#### **AdmissionSettings**
```javascript
{
  cutoffMark: Number,                // required, default: 180
  lastUpdatedBy: ObjectId            // ref: "User"
}
```

### Existing Models (Not Modified)

#### **Applicant**
```javascript
{
  firstName: String,     // required, trimmed
  lastName: String,      // required, trimmed
  email: String,         // required, lowercase, indexed
  phone: String,         // required
  dateOfBirth: Date      // required
}
```

#### **AdmissionCycle**
```javascript
{
  name: String,                     // required, trimmed
  academicSessionId: ObjectId,      // ref: "AcademicSession" (required)
  admissionType: String,            // enum: ["utme", "directEntry", "postgraduate"] (required)
  startDate: Date,                  // required
  endDate: Date,                    // required
  isActive: Boolean                 // default: false
}
```

## 2️⃣ Controllers

### **AdmissionController**
Handles application lifecycle and status management.

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/submit/:applicationId` | POST | Submit application (draft → submitted) | `{applicationId}` | `{application, nextSteps}` |
| `/schedule-post-utme/:applicationId` | POST | Schedule Post-UTME exam | `{date, venue, time}` | `{application, schedule}` |
| `/record-post-utme-score/:applicationId` | POST | Record Post-UTME score | `{score, remarks}` | `{application, score}` |
| `/decide` | POST | Make admission decision | `{applicationId, decision, notes}` | `{application, decision}` |
| `/dashboard` | GET | Get applicant dashboard | - | `{dashboardData}` |
| `/applications/:applicationId` | GET | Get application details | - | `{application}` |
| `/review-queue` | GET | Get admin review queue | Query filters | `{applications, pagination}` |
| `/statistics/:admissionCycleId` | GET | Get application statistics | - | `{statistics}` |

**Audit Context**: Attached in all mutating endpoints (submit, schedule, record score, decide)

### **AdmissionDocumentController**
Manages document upload and verification.

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/upload` | POST | Upload admission document | `file, {admissionApplicationId, category, metadata}` | `{document, file, autoVerification}` |
| `/verify/:documentId` | POST | Verify/reject document (manual) | `{isVerified, score, rejectionReason, remarks}` | `{document}` |
| `/documents/:applicationId` | GET | Get application documents | Query: `includeUrls` | `{[documents]}` |
| `/documents/review` | GET | Get documents for manual review | Query filters | `{documents, pagination}` |
| `/download/:documentId` | GET | Download document file | - | Redirect to signed URL |
| `/verification-status/:applicationId` | GET | Check verification status | - | `{allVerified, verified, required, missing}` |

**Audit Context**: Attached in upload and verify endpoints

### **AdmissionAcceptanceController**
Handles admission acceptance and payment.

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/acceptance` | POST | Record admission acceptance | `{admissionApplicationId, accepted, acceptanceFeeReference}` | `{acceptance, admissionLetter}` |
| `/verify-fee/:applicationId` | POST | Verify acceptance fee payment | `{reference, amount, currency, paymentMethod}` | `{application, paymentVerified}` |
| `/acceptance-status/:applicationId` | GET | Get acceptance status | - | `{hasAccepted, accepted, feeStatus, admissionLetter}` |
| `/admission-letter/:applicationId` | GET | Download admission letter | - | Redirect to signed URL |
| `/regenerate-letter/:applicationId` | POST | Regenerate admission letter | - | `{file}` |

**Audit Context**: Attached in acceptance, fee verification, and letter generation

## 3️⃣ Services

### **AdmissionService**
Main application lifecycle management.

**Core Methods:**
- `submitApplication()` - Transitions from draft → submitted, validates JAMB eligibility
- `checkJAMBEligibility()` - Validates JAMB score against cutoff mark
- `schedulePostUTME()` - Schedules exam (requires all docs verified)
- `recordPostUTMEScore()` - Records score, triggers aggregate calculation
- `calculateAggregateScore()` - Calculates weighted aggregate (JAMB 60% + Post-UTME 40%)
- `makeAdmissionDecision()` - Admits/rejects/waitlists based on aggregate
- `getApplicantDashboard()` - UI-friendly data with progress indicators
- `getAdminReviewQueue()` - Paginated queue for admin review

**State Machine Enforcement:**
```
draft → submitted → underReview → postUTMEScheduled → postUTMEScoreReceived → 
aggregateCalculated → admitted | rejected | waitlisted
```

**Status Transitions Validation:**
- Each transition validates current status
- Checks document requirements
- Verifies role permissions
- Prevents illegal transitions

### **AdmissionDocumentService**
Document upload and verification management.

**Core Methods:**
- `uploadDocument()` - Handles file upload, auto-verification, metadata extraction
- `performAutoVerification()` - Automatic checks (file type, size, integrity, category-specific)
- `verifyDocument()` - Manual verification by staff
- `getDocumentsForReview()` - Queue for manual review
- `areAllDocumentsVerified()` - Checks if all required docs are verified

**Document Verification Rules:**
- **Auto-Verification**: File type, size, basic integrity, category patterns
- **Manual Verification**: Required for authenticity, content validation
- **Verification Score**: 0-1 scale, auto-verified if ≥0.8
- **Rejection Reasons**: blurry, incomplete, expired, fake, wrongDocument, other

**Category-Specific Checks:**
- JAMB Result: Pattern matching for JAMB slip
- O'Level: WAEC/NECO pattern detection
- Passport: Image validation, dimensions

### **AdmissionAcceptanceService**
Acceptance and payment handling.

**Core Methods:**
- `recordAcceptance()` - Records applicant's acceptance decision
- `generateAdmissionLetter()` - Creates official admission letter PDF
- `verifyAcceptanceFee()` - Payment verification (webhook integration)
- `getAcceptanceStatus()` - Current acceptance and payment status

**Payment Integration:**
- Supports payment gateway webhooks
- Stores payment references
- Verifies payment amounts
- Updates application metadata

**Admission Letter Generation:**
- Creates PDF with applicant/programme details
- Stores in file system with signed URLs
- Regeneratable if needed

### **AdmissionValidationService**
Business rule validation.

**Core Methods:**
- `validateStatusTransition()` - Validates state machine transitions
- `validateDocumentRequirements()` - Checks doc requirements per status
- `validateJAMBScore()` - Validates against cutoff mark
- `validateAggregateScore()` - Validates against programme cutoff

## 4️⃣ Routes

### **Applicant-Facing Routes** (`/admissions/applicant`)
Accessible by authenticated applicants only.

| Route | Method | Purpose |
|-------|--------|---------|
| `/dashboard` | GET | Application dashboard |
| `/applications/:id` | GET | Application details |
| `/documents/upload` | POST | Upload document |
| `/applications/:id/documents` | GET | Get application docs |
| `/documents/:id/download` | GET | Download document |
| `/applications/:id/verification-status` | GET | Check verification status |
| `/acceptance` | POST | Record acceptance |
| `/applications/:id/acceptance-status` | GET | Get acceptance status |
| `/applications/:id/admission-letter` | GET | Download admission letter |

### **Admin-Facing Routes** (`/admissions/admin`)
Accessible by admin, admissionOfficer, reviewer roles.

| Route | Method | Purpose |
|-------|--------|---------|
| `/review-queue` | GET | Admin review queue |
| `/applications/:id/submit` | POST | Submit application (admin) |
| `/applications/:id/schedule-post-utme` | POST | Schedule Post-UTME |
| `/applications/:id/record-post-utme-score` | POST | Record Post-UTME score |
| `/applications/decide` | POST | Make admission decision |
| `/documents/review` | GET | Documents for manual review |
| `/documents/:id/verify` | POST | Verify/reject document |
| `/applications/:id/verify-fee` | POST | Verify acceptance fee |
| `/applications/:id/regenerate-letter` | POST | Regenerate admission letter |
| `/statistics/:cycleId` | GET | Application statistics |

## 5️⃣ Validators

### **Admission Validators**

**Application Submission:**
```javascript
{
  applicationId: Joi.string().hex().length(24).required()
}
```

**Post-UTME Schedule:**
```javascript
{
  applicationId: Joi.string().hex().length(24).required(),
  date: Joi.date().greater("now").required(),
  venue: Joi.string().min(5).max(200).required(),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
}
```

**Post-UTME Score:**
```javascript
{
  applicationId: Joi.string().hex().length(24).required(),
  score: Joi.number().min(0).max(100).required(),
  remarks: Joi.string().max(500).optional()
}
```

**Admission Decision:**
```javascript
{
  applicationId: Joi.string().hex().length(24).required(),
  decision: Joi.string().valid("admitted", "rejected", "waitlisted").required(),
  notes: Joi.string().max(1000).optional()
}
```

### **Document Validators**

**Document Upload:**
```javascript
{
  admissionApplicationId: Joi.string().hex().length(24).required(),
  category: Joi.string().valid("jambResult", "oLevelResult", ...).required(),
  metadata: Joi.object().optional()
}
```

**Document Verification:**
```javascript
{
  documentId: Joi.string().hex().length(24).required(),
  isVerified: Joi.boolean().required(),
  score: Joi.when("isVerified", {is: true, then: Joi.number().min(0).max(1).required()}),
  rejectionReason: Joi.when("isVerified", {is: false, then: Joi.string().valid(...).required()})
}
```

### **Acceptance Validators**

**Admission Acceptance:**
```javascript
{
  admissionApplicationId: Joi.string().hex().length(24).required(),
  accepted: Joi.boolean().required(),
  acceptanceFeeReference: Joi.when("accepted", {
    is: true, 
    then: Joi.string().min(10).max(100).required()
  })
}
```

**Fee Verification:**
```javascript
{
  applicationId: Joi.string().hex().length(24).required(),
  reference: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid("NGN", "USD", "EUR").default("NGN")
}
```

## 6️⃣ Document Handling

### **Document Lifecycle**
```
notStarted → uploaded → underReview → verified | rejected
```

**Required Documents:**
1. JAMB Result Slip
2. O'Level Result (WAEC/NECO)
3. Birth Certificate
4. Passport Photograph
5. Reference Letter (for admission)
6. Local Government Identification
7. Post-UTME Result (system-generated)

### **Verification Process**

**Automatic Checks (System):**
- File type validation (PDF, JPG, PNG)
- Size limit (5MB max)
- Basic integrity check
- Category-specific pattern matching
- OCR metadata extraction (placeholder)

**Manual Checks (Staff):**
- Document authenticity
- Content accuracy
- Expiration validation
- Quality assessment

**Verification Rules:**
- Auto-verified if score ≥ 0.8
- Manual review if auto-verification fails
- Verified documents are immutable
- Rejected documents can be re-uploaded
- Rejection requires reason and notes

### **File Storage Integration**
- Uses existing File module
- Domain: `admissionDocument`
- Private storage with signed URLs
- Access control: admin, admissionOfficer roles
- Metadata includes category, applicant info

## 7️⃣ Audit Context

### **Audit Context Structure**
Every mutating operation attaches `req.auditContext`:

```javascript
{
  action: "ACTION_NAME",            // Uppercase constant
  status: "SUCCESS" | "FAILURE",
  message: "Human readable message",
  timestamp: Date,
  metadata: {
    entityId: ObjectId,
    performedBy: "userRole",
    performedByUserId: ObjectId,
    applicantId: ObjectId,
    admissionApplicationId: ObjectId,
    admissionCycleId: ObjectId
  },
  changes: {
    before: { /* previous state */ },
    after: { /* new state */ }
  }
}
```

### **Audit Actions**
```javascript
APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED"
DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED"
DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED"
DOCUMENT_REJECTED: "DOCUMENT_REJECTED"
POST_UTME_SCHEDULED: "POST_UTME_SCHEDULED"
POST_UTME_SCORE_RECORDED: "POST_UTME_SCORE_RECORDED"
AGGREGATE_CALCULATED: "AGGREGATE_CALCULATED"
ADMISSION_DECIDED: "ADMISSION_DECIDED"
ACCEPTANCE_RECORDED: "ACCEPTANCE_RECORDED"
ADMISSION_LETTER_GENERATED: "ADMISSION_LETTER_GENERATED"
```

### **Audit Middleware**
`auditAdmissionAction` middleware:
- Attaches to all routes
- Captures response data
- Saves to AuditLog collection
- Non-blocking (errors don't fail request)

**Example Controller Usage:**
```javascript
// In controller:
const result = await AdmissionService.submitApplication(...);
req.auditContext = result.auditContext; // Attach for middleware
```

## 8️⃣ Key Business Logic

### **Post-UTME & Aggregate Calculation**
```
Aggregate = (JAMB_Percentage × 0.6) + (Post-UTME_Score × 0.4)
Where JAMB_Percentage = (JAMB_Score ÷ 400) × 100
```

### **Status Transition Rules**
1. **draft → submitted**: All required docs uploaded, JAMB eligible
2. **submitted → postUTMEScheduled**: All docs verified
3. **postUTMEScheduled → postUTMEScoreReceived**: Score recorded (0-100)
4. **postUTMEScoreReceived → aggregateCalculated**: Automatic calculation
5. **aggregateCalculated → admitted|rejected|waitlisted**: Decision based on aggregate

### **Document Requirements by Status**
- **Submitted**: JAMB, O'Level, Birth Cert, Passport (uploaded)
- **Post-UTME Scheduled**: All above verified
- **Admitted**: All above + Reference Letter verified

### **Access Control**
- **Applicants**: Own applications only, upload docs, accept admission
- **Admission Officers**: Review, schedule exams, record scores
- **Admins**: All operations, make final decisions
- **Reviewers**: Document verification only

## 9️⃣ Constants

### **Application Status**
```javascript
DRAFT: "draft"
SUBMITTED: "submitted"
UNDER_REVIEW: "underReview"
POST_UTME_SCHEDULED: "postUTMEScheduled"
POST_UTME_SCORE_RECEIVED: "postUTMEScoreReceived"
AGGREGATE_CALCULATED: "aggregateCalculated"
ADMITTED: "admitted"
REJECTED: "rejected"
WAITLISTED: "waitlisted"
```

### **Document Categories**
```javascript
JAMB_RESULT: "jambResult"
O_LEVEL_RESULT: "oLevelResult"
BIRTH_CERTIFICATE: "birthCertificate"
REFERENCE_LETTER: "referenceLetter"
LOCAL_GOVERNMENT_IDENTIFICATION: "localGovernmentIdentification"
PASSPORT_PHOTOGRAPH: "passportPhotograph"
POST_UTME_RESULT: "postUTMEResult"
```

### **Aggregate Weights**
```javascript
JAMB: 0.6      // 60% of aggregate
POST_UTME: 0.4 // 40% of aggregate
```

## 🔟 Usage Examples

### **Submit Application**
```javascript
// Applicant submits their application
POST /admissions/applicant/submit/:applicationId

// Validates:
// 1. Application is in draft status
// 2. All required documents uploaded
// 3. JAMB score meets cutoff (≥180)
// 4. Updates status to "submitted"
// 5. Creates audit log
```

### **Upload Document**
```javascript
// Applicant uploads JAMB result
POST /admissions/applicant/documents/upload

// Request:
// - file: JAMB_Slip.pdf
// - admissionApplicationId: "abc123"
// - category: "jambResult"

// Process:
// 1. Validates file (type, size)
// 2. Performs auto-verification (extracts score)
// 3. Creates document record
// 4. Links to file storage
// 5. Updates application if needed
```

### **Make Admission Decision**
```javascript
// Admin admits an applicant
POST /admissions/admin/decide

// Request:
{
  "applicationId": "abc123",
  "decision": "admitted",
  "notes": "Excellent aggregate score"
}

// Process:
// 1. Validates application in "aggregateCalculated" status
// 2. Creates AdmissionDecision record
// 3. Updates application status to "admitted"
// 4. Notifies applicant
// 5. Creates audit log
```

### **Accept Admission**
```javascript
// Applicant accepts admission offer
POST /admissions/applicant/acceptance

// Request:
{
  "admissionApplicationId": "abc123",
  "accepted": true,
  "acceptanceFeeReference": "PAY_REF_123456"
}

// Process:
// 1. Validates application is "admitted"
// 2. Verifies all documents are verified
// 3. Creates acceptance record
// 4. Verifies payment reference
// 5. Generates admission letter
```

---

**Generated Code Summary:**
- **Models**: 4 new admission models, 3 existing models used
- **Controllers**: 3 controllers with 18 endpoints
- **Services**: 4 services with core business logic
- **Routes**: 2 route groups (applicant/admin) with 18 routes
- **Validators**: 3 validator files with comprehensive validation
- **Constants**: Centralized enums and configurations
- **Middleware**: Audit middleware for all mutating operations

This system implements a complete Nigerian university admission workflow with document verification, Post-UTME handling, aggregate calculation, and remote completion capabilities.