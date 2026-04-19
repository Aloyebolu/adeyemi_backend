// scripts/migrate-to-org-units-v2.js
import OrganizationalUnit from "#domain/organization/organizationalUnit.model.js";
import OrganizationalUnitService from "#domain/organization/organizationalUnit.service.js";
import Faculty from "#domain/organization/faculty/faculty.model.js";
import Department from "#domain/organization/department/department.model.js";
import { AdminUnit } from "#domain/admin/adminUnits/models/adminUnit.model.js";
import { SYSTEM_USER_ID } from "#config/system.js";

async function migrateToOrgUnitsV2() {
  console.log("🚀 Starting migration to OrganizationalUnit v2...\n");
  
  const stats = { faculties: 0, departments: 0, adminUnits: 0, errors: [] };
  
  // Step 1: Create University Root
  let university = await OrganizationalUnit.findOne({ type: "university" });
  if (!university) {
    university = await OrganizationalUnitService.createUnit({
      name: "University",
      code: "UNIV",
      type: "university",
      description: "Root organizational unit"
    }, SYSTEM_USER_ID);
    console.log(`✅ Created University Root: ${university._id}\n`);
  }
  
  // Step 2: Migrate Faculties
  console.log("📚 Migrating Faculties...");
  const faculties = await Faculty.find({}).lean();
  
  for (const faculty of faculties) {
    try {
      const existing = await OrganizationalUnit.findOne({
        "_migrated_from.source_model": "Faculty",
        "_migrated_from.source_id": faculty._id
      });
      
      if (existing) {
        stats.faculties++;
        continue;
      }
      
      const unit = await OrganizationalUnitService.createUnit({
        name: faculty.name,
        code: faculty.code,
        type: "faculty",
        parent_unit: university._id,
        head_user_id: faculty.dean,
        _migrated_from: {
          source_model: "Faculty",
          source_id: faculty._id,
          migrated_at: new Date()
        },
        created_by: faculty.createdBy || SYSTEM_USER_ID
      }, SYSTEM_USER_ID);
      
      stats.faculties++;
      console.log(`  ✅ ${faculty.name} (${faculty.code})`);
      
    } catch (error) {
      stats.errors.push({ model: "Faculty", id: faculty._id, error: error.message });
      console.error(`  ❌ Failed: ${faculty.name} - ${error.message}`);
    }
  }
  
  // Step 3: Migrate Departments
  console.log("\n📖 Migrating Departments...");
  const departments = await Department.find({}).lean();
  const unitService = OrganizationalUnitService;
  
  for (const dept of departments) {
    try {
      const existing = await OrganizationalUnit.findOne({
        "_migrated_from.source_model": "Department",
        "_migrated_from.source_id": dept._id
      });
      
      if (existing) {
        stats.departments++;
        continue;
      }
      
      // Find migrated parent faculty
      const parentFaculty = await OrganizationalUnit.findOne({
        "_migrated_from.source_model": "Faculty",
        "_migrated_from.source_id": dept.faculty
      });
      
      if (!parentFaculty) {
        throw new Error(`Parent faculty not migrated: ${dept.faculty}`);
      }
      
      const unit = await unitService.createUnit({
        name: dept.name,
        code: dept.code,
        type: "department",
        parent_unit: parentFaculty._id,
        head_user_id: dept.hod,
        _migrated_from: {
          source_model: "Department",
          source_id: dept._id,
          migrated_at: new Date()
        },
        created_by: dept.createdBy || SYSTEM_USER_ID
      }, SYSTEM_USER_ID);
      
      stats.departments++;
      console.log(`  ✅ ${dept.name} (${dept.code})`);
      
    } catch (error) {
      stats.errors.push({ model: "Department", id: dept._id, error: error.message });
      console.error(`  ❌ Failed: ${dept.name} - ${error.message}`);
    }
  }
  
  // Step 4: Migrate Admin Units
  console.log("\n🏢 Migrating Administrative Units...");
  const adminUnits = await AdminUnit.find({}).lean();
  
  for (const admin of adminUnits) {
    try {
      const existing = await OrganizationalUnit.findOne({
        "_migrated_from.source_model": "AdminUnit",
        "_migrated_from.source_id": admin._id
      });
      
      if (existing) {
        stats.adminUnits++;
        continue;
      }
      
      let parentId = university._id;
      if (admin.parent_unit) {
        const parent = await OrganizationalUnit.findOne({
          "_migrated_from.source_model": "AdminUnit",
          "_migrated_from.source_id": admin.parent_unit
        });
        if (parent) parentId = parent._id;
      }
      
      const unit = await unitService.createUnit({
        name: admin.name,
        code: admin.code || `ADM-${admin._id.toString().slice(-6)}`,
        type: admin.type,
        parent_unit: parentId,
        head_user_id: admin.head,
        description: admin.description,
        _migrated_from: {
          source_model: "AdminUnit",
          source_id: admin._id,
          migrated_at: new Date()
        }
      }, SYSTEM_USER_ID);
      
      stats.adminUnits++;
      console.log(`  ✅ ${admin.name} (${admin.type})`);
      
    } catch (error) {
      stats.errors.push({ model: "AdminUnit", id: admin._id, error: error.message });
      console.error(`  ❌ Failed: ${admin.name} - ${error.message}`);
    }
  }
  
  // Summary
  console.log("\n✨ Migration Complete!");
  console.log(`   Faculties: ${stats.faculties}`);
  console.log(`   Departments: ${stats.departments}`);
  console.log(`   Admin Units: ${stats.adminUnits}`);
  console.log(`   Errors: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    stats.errors.forEach(e => console.log(`   - ${e.model} ${e.id}: ${e.error}`));
  }
  
  return stats;
}

export default migrateToOrgUnitsV2;