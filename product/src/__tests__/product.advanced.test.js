const request = require("supertest");

// Mock authentication middleware BEFORE importing app
jest.mock("../middlewares/auth.middlerware", () => {
  return jest.fn(() => {
    return (req, res, next) => {
      // Bypass authentication for tests
      next();
    };
  });
});

// Mock imageUpload service
jest.mock("../services/imageUpload.service");

const app = require("../app");
const Product = require("../models/product.model");
const { connectTestDB, closeTestDB, clearTestDB } = require("./setup/testDb");
const {
  generateObjectId,
  createMockProduct,
  createMockImageKitResponse,
  createMockImageBuffer,
} = require("./setup/fixtures");
const { uploadMultipleImages } = require("../services/imageUpload.service");

// ADD THIS MOCK:
jest.mock("../middlewares/auth.middlerware", () => {
  return jest.fn(() => {
    return (req, res, next) => {
      // Bypass auth - let controller use req.body.seller
      next();
    };
  });
});


// Mock imageUpload service
jest.mock("../services/imageUpload.service");

describe("POST /api/product/ - Advanced Tests", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
    uploadMultipleImages.mockResolvedValue([]);
  });

  describe("Using Test Fixtures", () => {
    it("should create product using fixture data", async () => {
      const productData = createMockProduct({
        title: "Fixture Product",
        price: 199.99,
      });

      const response = await request(app)
        .post("/api/product/")
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Fixture Product");
      expect(response.body.data.price.amount).toBe(199.99);
    });

    it("should handle multiple products with different sellers", async () => {
      const seller1 = generateObjectId();
      const seller2 = generateObjectId();

      const product1 = createMockProduct({ seller: seller1, title: "Product 1" });
      const product2 = createMockProduct({ seller: seller2, title: "Product 2" });

      const response1 = await request(app)
        .post("/api/product/")
        .send(product1)
        .expect(201);

      const response2 = await request(app)
        .post("/api/product/")
        .send(product2)
        .expect(201);

      expect(response1.body.data.seller).toBe(seller1);
      expect(response2.body.data.seller).toBe(seller2);

      // Verify both products exist in database
      const products = await Product.find({});
      expect(products).toHaveLength(2);
    });
  });

  describe("Image Upload Edge Cases", () => {
    it("should handle exactly 5 images (maximum allowed)", async () => {
      const mockUploadedImages = Array.from({ length: 5 }, (_, i) =>
        createMockImageKitResponse({ id: `file_${i}` })
      );

      uploadMultipleImages.mockResolvedValue(mockUploadedImages);

      const productData = createMockProduct();

      const response = await request(app)
        .post("/api/product/")
        .field("title", productData.title)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", createMockImageBuffer(), "image1.jpg")
        .attach("images", createMockImageBuffer(), "image2.jpg")
        .attach("images", createMockImageBuffer(), "image3.jpg")
        .attach("images", createMockImageBuffer(), "image4.jpg")
        .attach("images", createMockImageBuffer(), "image5.jpg")
        .expect(201);

      expect(response.body.data.images).toHaveLength(5);
      expect(uploadMultipleImages).toHaveBeenCalledTimes(1);
    });

    it("should handle different image formats", async () => {
      const mockResponse = [createMockImageKitResponse()];
      uploadMultipleImages.mockResolvedValue(mockResponse);

      const productData = createMockProduct();
      const imageFormats = ["image.jpg", "image.png", "image.gif", "image.webp"];

      for (const format of imageFormats) {
        jest.clearAllMocks();
        await clearTestDB();

        const response = await request(app)
          .post("/api/product/")
          .field("title", productData.title)
          .field("price", productData.price)
          .field("seller", productData.seller)
          .attach("images", createMockImageBuffer(), format)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(uploadMultipleImages).toHaveBeenCalledWith(
          expect.any(Array),
          "/products"
        );
      }
    });

    it("should handle partial ImageKit upload failure", async () => {
      // Upload service fails
      uploadMultipleImages.mockRejectedValueOnce(new Error("ImageKit upload failed"));

      const productData = createMockProduct();

      const response = await request(app)
        .post("/api/product/")
        .field("title", productData.title)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", createMockImageBuffer(), "image1.jpg")
        .attach("images", createMockImageBuffer(), "image2.jpg")
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(uploadMultipleImages).toHaveBeenCalledTimes(1);
    });
  });

  describe("Price and Currency Validation", () => {
    it("should handle different currency types", async () => {
      const currencies = ["USD", "INR"];

      for (const currency of currencies) {
        await clearTestDB();

        const productData = createMockProduct({ currency });

        const response = await request(app)
          .post("/api/product/")
          .send(productData)
          .expect(201);

        expect(response.body.data.price.currency).toBe(currency);
      }
    });

    it("should handle decimal prices correctly", async () => {
      const prices = [0.99, 10.50, 999.99, 1234.56];

      for (const price of prices) {
        await clearTestDB();

        const productData = createMockProduct({ price });

        const response = await request(app)
          .post("/api/product/")
          .send(productData)
          .expect(201);

        expect(response.body.data.price.amount).toBe(price);
      }
    });

    it("should handle string price conversion", async () => {
      const productData = createMockProduct();

      const response = await request(app)
        .post("/api/product/")
        .field("title", productData.title)
        .field("price", "99.99") // String instead of number
        .field("seller", productData.seller)
        .expect(201);

      expect(response.body.data.price.amount).toBe(99.99);
      expect(typeof response.body.data.price.amount).toBe("number");
    });
  });

  describe("Product Data Integrity", () => {
    it("should trim whitespace from title", async () => {
      const productData = createMockProduct({
        title: "  Product with spaces  ",
      });

      const response = await request(app)
        .post("/api/product/")
        .send(productData)
        .expect(201);

      expect(response.body.data.title).toBe("Product with spaces");
    });

    it("should include timestamps", async () => {
      const productData = createMockProduct();

      const response = await request(app)
        .post("/api/product/")
        .send(productData)
        .expect(201);

      expect(response.body.data).toHaveProperty("createdAt");
      expect(response.body.data).toHaveProperty("updatedAt");
      expect(new Date(response.body.data.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.data.updatedAt)).toBeInstanceOf(Date);
    });

    it("should store seller as ObjectId", async () => {
      const sellerId = generateObjectId();
      const productData = createMockProduct({ seller: sellerId });

      const response = await request(app)
        .post("/api/product/")
        .send(productData)
        .expect(201);

      expect(response.body.data.seller).toBe(sellerId);

      // Verify in database
      const savedProduct = await Product.findById(response.body.data._id);
      expect(savedProduct.seller.toString()).toBe(sellerId);
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle multiple concurrent product creations", async () => {
      const products = Array.from({ length: 3 }, (_, i) =>
        createMockProduct({ title: `Concurrent Product ${i + 1}` })
      );

      const promises = products.map((product) =>
        request(app).post("/api/product/").send(product)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.title).toBe(`Concurrent Product ${index + 1}`);
      });

      // Verify all products in database
      const savedProducts = await Product.find({});
      expect(savedProducts).toHaveLength(3);
    });
  });
});
