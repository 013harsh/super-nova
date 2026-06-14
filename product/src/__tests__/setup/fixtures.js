const mongoose = require("mongoose");

const generateObjectId = () => {
  return new mongoose.Types.ObjectId().toString();
};


const createMockProduct = (overrides = {}) => {
  return {
    title: "Test Product",
    description: "Test product description",
    price: 99.99,
    currency: "INR",
    seller: generateObjectId(),
    ...overrides,
  };
};


const createMockImageKitResponse = (overrides = {}) => {
  const timestamp = Date.now();
  return {
    url: `https://ik.imagekit.io/test/products/image_${timestamp}.jpg`,
    thumbnailUrl: `https://ik.imagekit.io/test/products/tr:n-media_library_thumbnail/image_${timestamp}.jpg`,
    id: `mock_file_id_${timestamp}`,
    ...overrides,
  };
};


const createMockImageBuffer = (size = 1024) => {
  return Buffer.alloc(size, "fake image content");
};

module.exports = {
  generateObjectId,
  createMockProduct,
  createMockImageKitResponse,
  createMockImageBuffer,
};
