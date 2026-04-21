import connectToDB from "#config/db.js";
import studentModel from "#domain/user/student/student.model.js";
import userModel from "#domain/user/user.model.js";
await connectToDB()
// Get all students with their user data and update user names in one go
const students = [
  // Bsc 100l
  { matricNumber: "CCS/2024/0002U", firstName: "darasimi", middleName: "emmanuel", lastName: "agbeleye" },
  { matricNumber: "CCS/2024/0003U", firstName: "joseph", middleName: "feranmi", lastName: "aina" },
  { matricNumber: "CCS/2024/0004U", firstName: "peter", middleName: "shola", lastName: "banjo" },
  { matricNumber: "CCS/2024/0005U", firstName: "ifeoluwa", middleName: "azeez", lastName: "fatunbi" },
  { matricNumber: "CCS/2024/0007U", firstName: "ademola", middleName: "mubarak", lastName: "olasupo" },
  { matricNumber: "CCS/2024/0008U", firstName: "olalekan", middleName: "habeeb", lastName: "olayinka" },
  { matricNumber: "CCS/2024/0009U", firstName: "franklyn", middleName: "adebayo", lastName: "adeyoju" },
  { matricNumber: "CCS/2024/0010U", firstName: "princess", middleName: "adenike", lastName: "adenugba" },
  { matricNumber: "CCS/2024/0011U", firstName: "mosope", middleName: "harmony", lastName: "olaoluwa" },
  { matricNumber: "CCS/2024/0012U", firstName: "adedimeji", middleName: "muiz", lastName: "banjo" },
  { matricNumber: "CCS/2024/0013U", firstName: "ayomide", middleName: "joshua", lastName: "ibetoye" },
  { matricNumber: "CCS/2024/0014U", firstName: "adekunle", middleName: "timothy", lastName: "oyelete" },
  { matricNumber: "CCS/2024/0015U", firstName: "happiness", middleName: "goodness", lastName: "ogala" },
  { matricNumber: "CCS/2024/0016U", firstName: "oluwatosin", middleName: "adebola", lastName: "adekoya" },
  { matricNumber: "CCS/2024/0017U", firstName: "esther", middleName: "wonuola", lastName: "binuyo" },
  { matricNumber: "CCS/2024/0018U", firstName: "opeyemi", middleName: "israel", lastName: "oluwaolegbe" },
  { matricNumber: "CCS/2024/0019U", firstName: "titilayo", middleName: "praise", lastName: "olayioye" },
  { matricNumber: "CCS/2024/0020U", firstName: "kazeem", middleName: "toheeb", lastName: "ibrahim" },
  { matricNumber: "CCS/2024/0021U", firstName: "ilemobola", middleName: "victor", lastName: "abe" },
  { matricNumber: "CCS/2024/0023U", firstName: "francis", middleName: "ayomide", lastName: "adegoke" },
  { matricNumber: "CCS/2024/0024U", firstName: "jeremiah", middleName: "benson", lastName: "jaja" },
  { matricNumber: "CCS/2024/0025U", firstName: "kolawole", middleName: "smart", lastName: "akinrimisi" },
  // BscEd 200l
  { matricNumber: "CSC/2024/0001D", firstName: "nathan", middleName: "success", lastName: "ajayi" },
  { matricNumber: "CSC/2024/0002D", firstName: "ayomiposi", middleName: "abimbola", lastName: "akinbobola" },
  { matricNumber: "CSC/2024/0003D", firstName: "iyanu", middleName: "busayo", lastName: "esho" },
  { matricNumber: "CSC/2024/0004D", firstName: "oyesunkanmi", middleName: "lateef", lastName: "gbadamosi" },
  { matricNumber: "CSC/2024/0005D", firstName: "johnson", middleName: "temitope", lastName: "godwin" },
  { matricNumber: "CSC/2024/0006D", firstName: "oghenevwegba", middleName: "israel", lastName: "isiboru" },
  { matricNumber: "CSC/2024/0007D", firstName: "olanike", middleName: "deborah", lastName: "olajide" },
  { matricNumber: "CSC/2024/0008D", firstName: "philip", middleName: "abiodun", lastName: "olupohunda" },
  { matricNumber: "CSC/2024/0009D", firstName: "oladimeji", middleName: "moses", lastName: "omobayo" },
  { matricNumber: "CSC/2024/0010D", firstName: "opeyemi", middleName: "toheeb", lastName: "owoeye" },
  { matricNumber: "CSC/2024/0011D", firstName: "adewumi", middleName: "emmanuel", lastName: "titus" }
];

// Find students by matricNumber, get their _id, and update User model
const bulkOps = [];

for (const student of students) {
  const studentDoc =await studentModel.findOne({ matricNumber: student.matricNumber });
  if (studentDoc) {
    const updateData = {
      first_name: student.firstName,
      last_name: student.lastName
    };
    if (student.middleName) {
      updateData.middle_name = student.middleName;
    }
    
    bulkOps.push({
      updateOne: {
        filter: { _id: studentDoc._id },
        update: { $set: updateData }
      }
    });
  }
  else(
    console.log("not found")
  )
}

if (bulkOps.length > 0) {
  const result =await userModel.bulkWrite(bulkOps);
  console.log(`Updated ${result.modifiedCount} users successfully`);
} else {
  console.log("No matching students found");
}