# 📊 Academic Results Computation System - Comprehensive Documentation

## 🎯 **Overview**

This is a **unified results computation engine** for a university system that processes student results, calculates GPAs/CGPAs, determines academic standing, and generates master sheets for both **preview** (simulation) and **final** (production) computations.

## 📁 **Architecture Overview**

```
┌─────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                      │
│  computation.controller.js (orchestrates everything)    │
│  previewComputation.controller.js  ←──┐                 │
│  finalComputation.controller.js   ←───┤ Unified via     │
│                                        │ computation.handler.js
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                       │
│  • ComputationCore (shared logic)                       │
│  • AcademicStandingEngine (probation/termination rules) │
│  • GPACalculator (GPA/CGPA calculations)               │
│  • SummaryListBuilder (data structuring)                │
│  • BulkWriter (database operations)                     │
│  • CarryoverService (failed course handling)            │
│  • ReportService (notifications & reports)              │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                     MODEL LAYER                         │
│  • ComputationSummary (department-level results)        │
│  • MasterComputation (university-wide tracking)         │
│  • CourseRegistration (student registrations)           │
│  • Result (individual course results)                   │
│  • Student (student records)                           │
│  • Semester (academic semesters)                        │
└─────────────────────────────────────────────────────────┘
```

## 🏗️ **Core Components**

### 1. **Computation Models**

#### **`ComputationSummary`** (`computation.model.js`)
- **Purpose**: Stores department-level computation results with **level-based organization**
- **Key Features**:
  - `studentSummariesByLevel`: Map of student data organized by academic level
  - `keyToCoursesByLevel`: Map of courses offered at each level
  - `studentListsByLevel`: Pass/probation/withdrawal lists by level
  - `masterSheetDataByLevel`: Pre-formatted data for master sheet generation
  - Supports both **preview** (`isPreview: true`) and **final** computations

#### **`MasterComputation`** (`masterComputation.model.js`)
- **Purpose**: Tracks university-wide computation across all departments
- **Key Features**:
  - `departmentSummaries`: Map of department processing stats
  - Tracks progress: `departmentsProcessed` / `totalDepartments`
  - Overall statistics: `overallAverageGPA`, `totalCarryovers`, etc.

### 2. **Computation Core Engine**

#### **`ComputationCore`** (`computation.core.js`)
- **Purpose**: **Shared logic** used by both preview and final computations
- **Key Methods**:
  - `processStudentBatch()`: Processes students in batches (100 at a time)
  - `processSingleStudent()`: Individual student GPA/CGPA calculation
  - `prepareSummaryData()`: Builds structured data for storage
- **State Management**:
  - `counters`: Track statistics (total students, average GPA, etc.)
  - `buffers`: Temporary storage for results before saving
  - `levelStats`: Statistics organized by academic level

### 3. **Specialized Services**

#### **`AcademicStandingEngine`** (`AcademicStandingEngine.js`)
- **Purpose**: Determines if student should be on probation, withdrawn, or terminated
- **Rules**:
  - **Withdrawal**: CGPA < 1.0 AND level > 100
  - **Probation**: CGPA < 1.5 OR semester GPA < 1.0
  - **Excellent**: CGPA ≥ 4.0
  - **Good**: CGPA ≥ 3.0
- **Special Cases**: Handles non-registration (suspension/termination)

#### **`GPACalculator`** (`GPACalculator.js`)
- **Purpose**: Calculate grades, GPA, CGPA with TCP/TNU tracking
- **Key Methods**:
  - `calculateSemesterGPA()`: Current semester performance
  - `calculateStudentCGPAWithTCP()`: Cumulative performance with credit tracking
  - `calculateOutstandingCourses()`: Failed courses (carryovers)
- **Grade System**: A(5), B(4), C(3), D(2), E(1), F(0)

#### **`SummaryListBuilder`** (`SummaryListBuilder.js`)
- **Purpose**: Structures data for master sheet and reporting
- **Key Structures Built**:
  - **MMS1**: Course-by-course results for current semester
  - **MMS2**: Cumulative academic history (TCP/TNU/CGPA)
  - **Key to Courses**: List of courses offered by level
  - **Student Lists**: Pass, probation, withdrawal, termination lists

#### **`BulkWriter`** (`BulkWriter.js`)
- **Purpose**: **Performance-optimized** batch database operations
- **Why it bypasses services**: Direct MongoDB bulk writes for speed
- **Operations**:
  - Student record updates (GPA, probation status)
  - Carryover course creation
  - Semester result records

#### **`CarryoverService`** (`CarryoverService.js`)
- **Purpose**: Manages failed courses that become carryovers
- **Rules**: Only **core courses** become carryovers (electives don't)
- **Integration**: Works with `BulkWriter` for efficient storage

### 4. **Controller Orchestration**

#### **`computation.controller.js`** (Main Entry Point)
- **Routes**: `/api/compute/all`, `/api/compute/preview`
- **Orchestrates**: Creates `MasterComputation`, queues department jobs
- **Job Types**: Routes to appropriate handler based on `isPreview` flag

#### **`previewComputation.controller.js`**
- **Purpose**: **Read-only** simulation of computation
- **No side effects**: Doesn't update student records or create carryovers
- **Output**: Generates `ComputationSummary` with `isPreview: true`

#### **`finalComputation.controller.js`**
- **Purpose**: **Production** computation with real consequences
- **Side effects**: Updates student GPA, creates carryovers, locks semesters
- **Process**: Uses `BulkWriter` for database updates

#### **`computation.handler.js`**
- **Purpose**: **Unified finalization** for both preview and final
- **Smart routing**: Uses strategy pattern based on computation type

## 🔄 **Data Flow**

### **Preview Computation Flow**:
```
1. User requests preview → computation.controller.js
2. Create MasterComputation with isPreview: true
3. Queue department jobs → previewComputation.controller.js
4. Process each department:
   a. Get students & results
   b. Calculate GPA/CGPA (ComputationCore)
   c. Determine academic standing (AcademicStandingEngine)
   d. Build summary data (SummaryListBuilder)
   e. Save to ComputationSummary (NO student updates)
5. Generate master sheet data
6. Return preview results
```

### **Final Computation Flow**:
```
1. User requests final computation → computation.controller.js
2. Create MasterComputation with isFinal: true
3. Queue department jobs → finalComputation.controller.js
4. Process each department:
   a. Get students & results
   b. Calculate GPA/CGPA
   c. Determine academic standing
   d. Process failed courses → CarryoverService
   e. Update student records → BulkWriter
   f. Create semester results → BulkWriter
   g. Build summary data
5. Lock semester (if successful)
6. Generate master sheets → MasterSheetService
7. Send notifications → ReportService
```

## 🗺️ **Key Data Structures**

### **Level-Based Organization**
The system organizes everything by **academic level** (100, 200, 300, 400, 500):
```javascript
// In ComputationSummary model:
studentSummariesByLevel: Map {  // NOT plain object!
  "100": [studentSummary1, studentSummary2, ...],
  "200": [studentSummary3, studentSummary4, ...],
  ...
}

// Why Maps? Better MongoDB serialization and preserves key types
```

### **Student Summary Structure**:
```javascript
{
  studentId: ObjectId,
  matricNumber: "ENG190001",
  name: "John Doe",
  level: "200",
  
  // MMS1: Current semester
  currentSemester: {
    tcp: 45,      // Total Credit Points
    tnu: 15,      // Total Number of Units
    gpa: 3.5      // Grade Point Average
  },
  
  // MMS2: Previous performance
  previousPerformance: {
    cumulativeTCP: 120,
    cumulativeTNU: 40,
    cumulativeGPA: 3.2,
    previousSemesterGPA: 3.4
  },
  
  // MMS2: Cumulative performance
  cumulativePerformance: {
    totalTCP: 165,  // previous + current
    totalTNU: 55,
    cgpa: 3.3       // Cumulative GPA
  },
  
  // Course results for master sheet
  courseResults: [
    { courseCode: "MTH101", score: 75, grade: "A", ... }
  ],
  
  // Outstanding courses (carryovers)
  outstandingCourses: [
    { courseCode: "PHY101", fromSemester: "2023/2024", attempts: 1 }
  ],
  
  academicStatus: "good" | "probation" | "withdrawal" | "terminated"
}
```

## ⚙️ **Configuration Constants**

### **Academic Rules** (`computationConstants.js`):
```javascript
ACADEMIC_RULES = {
  PROBATION_THRESHOLD: 1.50,      // CGPA < 1.5 → probation
  TERMINATION_THRESHOLD: 1.00,     // CGPA < 1.0 AND level > 100 → withdrawal
  PROBATION_SEMESTER_LIMIT: 2,     // 2 consecutive probation semesters
  CARRYOVER_LIMIT: 5,             // Max carryovers before termination
  EXCELLENT_GPA: 4.50,
  GOOD_GPA: 2.00,
  BATCH_SIZE: 100                  // Students processed per batch
}
```

### **Grade System**:
```javascript
GRADE_POINTS = { A:5, B:4, C:3, D:2, E:1, F:0 }
GRADE_BOUNDARIES = { A:70, B:60, C:50, D:45, E:40, F:0 }
// E grade (40-44) is passing but with 1 point
```

## 🔧 **Common Issues & Solutions**

### **1. Map vs Object Serialization**
```javascript
// ❌ WRONG: Direct assignment
summary.studentSummariesByLevel = studentSummariesByLevelObject;

// ✅ CORRECT: Convert to Map
summary.studentSummariesByLevel = new Map(
  Object.entries(studentSummariesByLevelObject)
);

// ✅ CORRECT: Retrieval
const summaries = Object.fromEntries(
  computationSummary.studentSummariesByLevel
);
```

### **2. Borrowed Courses Handling**
Courses can be "borrowed" from other departments. The system handles this:
```javascript
// In ResultService.processBorrowedCourse():
if (course.borrowedId) {
  // Use original course data but keep borrowing department
  return {
    ...originalCourseData,
    department: course.department,  // Borrowing department
    isBorrowed: true
  };
}
```

### **3. Performance Optimization**
- **Batching**: 100 students processed at once
- **Bulk Writes**: `BulkWriter` uses MongoDB bulk operations
- **Parallel fetching**: Students and results fetched together
- **Buffered processing**: Data collected before final save

### **4. Error Recovery**
- **Retry logic**: Failed departments can be retried
- **Partial completion**: `completed_with_errors` status
- **Notification system**: HODs notified of failures
- **Transaction safety**: MongoDB sessions for data consistency

## 🚀 **Development Workflow**

### **Adding New Computation Rules**:
1. Modify `AcademicStandingEngine.js` logic
2. Update constants in `computationConstants.js`
3. Test with preview computation first
4. Verify master sheet output

### **Adding New Report Fields**:
1. Extend `SummaryListBuilder.buildStudentSummary()`
2. Update `MasterSheetService` for Excel/PDF generation
3. Modify `ReportService` for notifications

### **Debugging Computation**:
```javascript
// Enable debug logging:
console.log('🔍 [DEBUG] Student processing:', {
  studentId: student._id,
  level: student.level,
  resultsCount: studentResults.length,
  gpaData,
  academicStanding
});

// Check Map serialization:
console.log('studentSummariesByLevel type:', 
  typeof computationSummary.studentSummariesByLevel,
  'Is Map:', computationSummary.studentSummariesByLevel instanceof Map
);
```

## 📈 **Monitoring & Reporting**

### **Status Endpoints**:
- `GET /api/computation/status/{masterComputationId}` - Overall progress
- `GET /api/computation/preview/status/{id}` - Preview status
- `GET /api/computation/history` - Past computations

### **Notifications**:
- **HODs**: Department completion with statistics
- **Students**: GPA/CGPA, academic standing, carryovers
- **Admins**: University-wide summary

### **Master Sheets**:
- **Excel**: Multiple sheets per level (MMS1, MMS2, lists)
- **PDF**: Printable format for official records
- **Level-based**: Separate sheets for 100, 200, 300, 400, 500 levels

## 🧪 **Testing Guidelines**

### **Preview vs Final**:
- **Always test with preview first** - no side effects
- **Verify**: GPA calculations, academic standing, master sheet format
- **Compare**: Preview vs final should match except for side effects

### **Edge Cases**:
1. **No results student**: Should be marked as failed processing
2. **All courses failed**: Should trigger termination rules
3. **Borrowed courses**: Should use original course data
4. **Non-registration**: Should suspend/terminate based on history

### **Performance Testing**:
- **Batch size**: Monitor memory with 1000+ students
- **Database**: Check bulk write performance
- **Memory**: Watch for leaks in buffered processing

## 🔗 **Integration Points**

### **External Systems**:
1. **Student Management**: Student records, levels, departments
2. **Course Management**: Course codes, units, core/elective status
3. **Result Management**: Individual course scores
4. **Notification System**: Email/SMS alerts
5. **Document Generation**: Excel/PDF master sheets

### **Queue System**:
- Uses Bull/Redis for job queuing
- Priority system for urgent computations
- Retry logic for failed departments

## 🎓 **Academic Concepts Explained**

### **TCP/TNU/CGPA**:
- **TCP (Total Credit Points)**: `gradePoint × courseUnit`
- **TNU (Total Number of Units)**: Sum of all course units
- **GPA (Grade Point Average)**: `TCP ÷ TNU` for semester
- **CGPA (Cumulative GPA)**: `Total TCP ÷ Total TNU` across all semesters

### **Academic Standing**:
- **Good**: CGPA ≥ 1.5, no issues
- **Probation**: CGPA < 1.5 OR semester GPA < 1.0
- **Withdrawal**: CGPA < 1.0 AND level > 100
- **Termination**: Excessive carryovers or rules violation

## 📚 **Further Reading**

1. **Mongoose Maps**: https://mongoosejs.com/docs/schematypes.html#maps
2. **MongoDB Bulk Operations**: https://docs.mongodb.com/manual/core/bulk-write-operations/
3. **Academic Grading Systems**: University-specific policies
4. **Bull Queue**: https://github.com/OptimalBits/bull

---

## 🆘 **Troubleshooting Checklist**

### **Computation Not Starting**:
- [ ] Check semester is active and not locked
- [ ] Verify department has results
- [ ] Check Redis/Bull queue is running
- [ ] Verify user has computation permissions

### **Incorrect GPA Calculations**:
- [ ] Verify grade boundaries match university policy
- [ ] Check course unit values
- [ ] Confirm borrowed course handling
- [ ] Validate TCP/TNU calculations

### **Missing Data in Master Sheets**:
- [ ] Check Map serialization in ComputationSummary
- [ ] Verify level-based grouping
- [ ] Confirm SummaryListBuilder output
- [ ] Check MasterSheetService input format

### **Performance Issues**:
- [ ] Reduce batch size from 100 to 50
- [ ] Check MongoDB indexes
- [ ] Monitor memory usage
- [ ] Verify bulk write operations

---

This system represents a **production-ready academic computation engine** with proper separation of concerns, performance optimizations, and comprehensive error handling. The level-based organization and unified preview/final architecture make it both flexible and maintainable for long-term use.