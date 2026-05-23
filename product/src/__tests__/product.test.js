const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");

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
const { uploadMultipleImages } = require("../services/imageUpload.service");

describe("POST /api/products/", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  describe("Success Cases", () => {
    it("should create a product without images", async () => {
      const productData = {
        title: "Test Product",
        description: "Test Description",
        price: 99.99,
        currency: "USD",
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Product created successfully");
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.title).toBe(productData.title);
      expect(response.body.data.description).toBe(productData.description);
      expect(response.body.data.price.amount).toBe(productData.price);
      expect(response.body.data.price.currency).toBe(productData.currency);
      expect(response.body.data.images).toEqual([]);

      // Verify product was saved to database
      const savedProduct = await Product.findById(response.body.data._id);
      expect(savedProduct).toBeTruthy();
      expect(savedProduct.title).toBe(productData.title);
    });

    it("should create a product with default currency INR", async () => {
      const productData = {
        title: "Test Product",
        description: "Test Description",
        price: 1999,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.price.currency).toBe("INR");
    });

    it("should create a product with images", async () => {
      // Mock uploadMultipleImages
      const mockUploadedImages = [
        {
          url: "https://ik.imagekit.io/test/products/image1.jpg",
          thumbnailUrl:
            "https://ik.imagekit.io/test/products/tr:n-media_library_thumbnail/image1.jpg",
          id: "mock_file_id_123",
        },
      ];

      uploadMultipleImages.mockResolvedValue(mockUploadedImages);

      const productData = {
        title: "Product with Images",
        description: "Product with image uploads",
        price: 299.99,
        currency: "USD",
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .field("title", productData.title)
        .field("description", productData.description)
        .field("price", productData.price)
        .field("currency", productData.currency)
        .field("seller", productData.seller)
        .attach("images", Buffer.from("fake image content"), "test-image.jpg")
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.images).toHaveLength(1);
      expect(response.body.data.images[0]).toEqual(
        expect.objectContaining(mockUploadedImages[0]),
      );

      // Verify uploadMultipleImages was called
      expect(uploadMultipleImages).toHaveBeenCalledTimes(1);
      expect(uploadMultipleImages).toHaveBeenCalledWith(
        expect.any(Array),
        "/products",
      );
    });

    it("should create a product with multiple images", async () => {
      const mockUploadedImages = [
        {
          url: "https://ik.imagekit.io/test/products/image1.jpg",
          thumbnailUrl:
            "https://ik.imagekit.io/test/products/tr:n-media_library_thumbnail/image1.jpg",
          id: "mock_file_id_1",
        },
        {
          url: "https://ik.imagekit.io/test/products/image2.jpg",
          thumbnailUrl:
            "https://ik.imagekit.io/test/products/tr:n-media_library_thumbnail/image2.jpg",
          id: "mock_file_id_2",
        },
      ];

      uploadMultipleImages.mockResolvedValue(mockUploadedImages);

      const productData = {
        title: "Product with Multiple Images",
        description: "Test Description",
        price: 499.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .field("title", productData.title)
        .field("description", productData.description)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", Buffer.from("fake image 1"), "image1.jpg")
        .attach("images", Buffer.from("fake image 2"), "image2.jpg")
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.images).toHaveLength(2);
      expect(uploadMultipleImages).toHaveBeenCalledTimes(1);
    });
  });

  describe("Validation Errors", () => {
    it("should return 400 if title is missing", async () => {
      const productData = {
        price: 99.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e) => e.field === "title")).toBe(true);
    });

    it("should return 400 if price is missing", async () => {
      const productData = {
        title: "Test Product",
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some((e) => e.field === "price")).toBe(true);
    });

    it("should return 400 if title is too short", async () => {
      const productData = {
        title: "AB", // Less than 3 characters
        price: 99.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should return 400 if price is negative", async () => {
      const productData = {
        title: "Test Product",
        price: -10,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should return 400 if currency is invalid", async () => {
      const productData = {
        title: "Test Product",
        price: 99.99,
        currency: "EUR", // Not in allowed list
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should return 400 for non-image file upload", async () => {
      const productData = {
        title: "Test Product",
        price: 99.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .field("title", productData.title)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", Buffer.from("fake pdf content"), "document.pdf")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("ImageKit Upload Errors", () => {
    it("should return 500 if imagekit upload fails", async () => {
      uploadMultipleImages.mockRejectedValue(
        new Error("ImageKit upload failed"),
      );

      const productData = {
        title: "Test Product",
        description: "Test Description",
        price: 99.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .field("title", productData.title)
        .field("description", productData.description)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", Buffer.from("fake image"), "test.jpg")
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Failed to create product");
    });
  });

  describe("File Size Limits", () => {
    it("should reject files larger than 51MB", async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      const productData = {
        title: "Test Product",
        price: 99.99,
        seller: new mongoose.Types.ObjectId().toString(),
      };

      const response = await request(app)
        .post("/api/products/")
        .field("title", productData.title)
        .field("price", productData.price)
        .field("seller", productData.seller)
        .attach("images", largeBuffer, "large-image.jpg")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });
});
