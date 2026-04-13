// import { MongoClient } from "mongodb";
// import fs from "fs";
// import path from "path";

// const uri = "mongodb://localhost:27017/afued_db";
// const client = new MongoClient(uri);

// async function exportSchemaSamples() {
//   try {
//     await client.connect();
//     const db = client.db("afued_db");
//     const collections = await db.collections();

//     for (const col of collections) {
//       const sample = await col.find({}).limit(5).toArray(); // get first 50 docs
//       const filePath = path.join(process.cwd(), "schema_samples", `${col.collectionName}.json`);
//       console.log("File path:", filePath);
//       fs.writeFileSync(filePath , JSON.stringify(sample, null, 2));
//       console.log(`✅ Exported ${col.collectionName}.json`);
//     }
//   } catch (err) {
//     console.error("❌ Error exporting schema:", err);
//   } finally {
//     await client.close();
//   }
// }

// exportSchemaSamples();
import fs from "fs";
import path from "path";

const folderPath = path.join(__dirname); // folder with your exported JSON files
const outputFile = path.join(__dirname, "merged_schema.json");

const merged = {};

fs.readdirSync(folderPath).forEach((file) => {
  if (file.endsWith(".json") && file !== "merged_schema.json") {
    const data = JSON.parse(fs.readFileSync(path.join(folderPath, file), "utf-8"));
    const collectionName = file.replace(".json", "");
    merged[collectionName] = data;
  }
});

fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2));
console.log("✅ Merged JSON created:", outputFile);
