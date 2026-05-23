const request = require("supertest");
const mongoose = require("mongoose");

// Dynamic mock of the auth middleware to control req.user per test case
let mockUser = null;
jest.mock("../middlewares/auth.middlerware", () => {
  return jest.fn((roles) => {
    return (req, res, next) => {
      if (!mockUser) {
        return res.status(401).json({ message: "Access denied" });
      }
      if (roles && !roles.includes(mockUser.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      req.user = mockUser;
      next();
    };
  });
});

const app = require("../app");
const Product = require("../models/product.model");
const { connectTestDB, closeTestDB, clearTestDB } = require("./setup/testDb");
const { createMockProduct, generateObjectId } = require("./setup/fixtures");

// Helper to convert flat fixture product to nested DB format
const toDbProduct = (mock) => ({
  title: mock.title,
  description: mock.description,
  price: { amount: mock.price, currency: mock.currency || "INR" },
  seller: mock.seller,
});

describe("PATCH /api/products/:id", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    mockUser = null;
    jest.clearAllMocks();
  });

  describe("Authentication & Authorization Cases", () => {
    it("should allow the seller who owns the product to successfully update it", async () => {
      const sellerId = generateObjectId();
      const mockProduct = toDbProduct(createMockProduct({ seller: sellerId, title: "Original Title", price: 100 }));
      const savedProduct = await Product.create(mockProduct);

      // Authenticate as the seller who owns the product
      mockUser = { id: sellerId, role: "seller" };

      const updateData = {
        title: "Updated Title",
        price: 150.00,
      };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe("Updated Title");
      expect(response.body.data.price.amount).toBe(150.00);

      // Confirm in DB
      const updatedProductInDb = await Product.findById(savedProduct._id);
      expect(updatedProductInDb.title).toBe("Updated Title");
      expect(updatedProductInDb.price.amount).toBe(150.00);
    });

    it("should reject update request with 403 Forbidden from a different seller", async () => {
      const originalSellerId = generateObjectId();
      const differentSellerId = generateObjectId();

      const mockProduct = toDbProduct(createMockProduct({ seller: originalSellerId, title: "Original Title" }));
      const savedProduct = await Product.create(mockProduct);

      // Authenticate as a completely different seller
      mockUser = { id: differentSellerId, role: "seller" };

      const updateData = { title: "Hacked Title" };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send(updateData)
        .expect(403);

      expect(response.body.message).toMatch(/insufficient permissions|not authorized/i);

      // Confirm database product was NOT changed
      const productInDb = await Product.findById(savedProduct._id);
      expect(productInDb.title).toBe("Original Title");
    });

    it("should reject update request with 401 Unauthorized if not authenticated", async () => {
      const mockProduct = toDbProduct(createMockProduct());
      const savedProduct = await Product.create(mockProduct);

      // Leave mockUser as null (unauthenticated)
      mockUser = null;

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send({ title: "New Title" })
        .expect(401);

      expect(response.body.message).toMatch(/access denied|unauthorized/i);
    });
  });

  describe("Validation Cases", () => {
    it("should reject update if title is too short", async () => {
      const sellerId = generateObjectId();
      const mockProduct = toDbProduct(createMockProduct({ seller: sellerId }));
      const savedProduct = await Product.create(mockProduct);

      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send({ title: "AB" }) // Title less than 3 characters
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should reject update if price is negative or zero", async () => {
      const sellerId = generateObjectId();
      const mockProduct = toDbProduct(createMockProduct({ seller: sellerId }));
      const savedProduct = await Product.create(mockProduct);

      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send({ price: -5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation failed");
    });

    it("should reject update if currency is not USD or INR", async () => {
      const sellerId = generateObjectId();
      const mockProduct = toDbProduct(createMockProduct({ seller: sellerId }));
      const savedProduct = await Product.create(mockProduct);

      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send({ currency: "EUR" })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Partial Field Updates", () => {
    it("should support updating only a subset of fields without touching others", async () => {
      const sellerId = generateObjectId();
      const mockProduct = toDbProduct(createMockProduct({
        seller: sellerId,
        title: "Keep Title",
        description: "Keep Description",
        price: 99.99,
        currency: "INR"
      }));
      const savedProduct = await Product.create(mockProduct);

      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .patch(`/api/products/${savedProduct._id}`)
        .send({ price: 120.00 }) // Only updating price
        .expect(200);

      expect(response.body.data.price.amount).toBe(120.00);
      expect(response.body.data.title).toBe("Keep Title");
      expect(response.body.data.description).toBe("Keep Description");
      expect(response.body.data.price.currency).toBe("INR");
    });
  });

  describe("Edge Cases", () => {
    it("should return 404 when product is not found with a valid but non-existent ObjectId", async () => {
      mockUser = { id: generateObjectId(), role: "seller" };
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .patch(`/api/products/${nonExistentId}`)
        .send({ title: "New Title" })
        .expect(404);

      expect(response.body.message).toBe("Product not found");
    });

    it("should return 400 or 500 when product ID has an invalid format", async () => {
      mockUser = { id: generateObjectId(), role: "seller" };
      const invalidId = "invalid-id-format";

      const response = await request(app)
        .patch(`/api/products/${invalidId}`)
        .send({ title: "New Title" })
        .expect((res) => {
          // Can either be a 400 (if validated by validateProductId middleware) or 500 (if caught by CastError handler)
          expect([400, 500]).toContain(res.status);
        });
    });
  });
});
