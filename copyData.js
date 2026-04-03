import { MongoClient } from "mongodb";

const oldUri = "mongodb+srv://ghazalsalameh:S%21taystrong99@cluster0.kxswde0.mongodb.net/lina-nails?retryWrites=true&w=majority";
const newUri = "mongodb+srv://ghazalsalameh_db_user:WhkOeAxfZaIerHOO@clusterlina.iglf7bz.mongodb.net/lina-nails?retryWrites=true&w=majority";

async function copyData() {
  const oldClient = new MongoClient(oldUri);
  const newClient = new MongoClient(newUri);

  try {
    await oldClient.connect();
    await newClient.connect();

    const oldDb = oldClient.db("lina-nails");
    const newDb = newClient.db("lina-nails");

    const collections = await oldDb.listCollections().toArray();

    for (const coll of collections) {
      const oldColl = oldDb.collection(coll.name);
      const newColl = newDb.collection(coll.name);

      const docs = await oldColl.find().toArray();
      if (docs.length > 0) {
        await newColl.insertMany(docs);
      }

      console.log(`Copied ${docs.length} docs from ${coll.name}`);
    }

    console.log("All collections copied!");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await oldClient.close();
    await newClient.close();
  }
}

copyData();