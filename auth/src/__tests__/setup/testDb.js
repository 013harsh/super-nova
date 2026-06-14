const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

const connectTestDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, });
    console.log("Connected to MongoDB Memory Server");
  } catch (error) {
    console.error("Error connecting to test database:", error);
    throw error;
  }
};

const disconnectTestDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log("Disconnected from MongoDB Memory Server");
  } catch (error) {
    console.error("Error disconnecting from test database:", error);
    throw error;
  }
};

const clearTestDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  } catch (error) {
    console.error("Error clearing test database:", error);
    throw error;
  }
};

module.exports = {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
};
