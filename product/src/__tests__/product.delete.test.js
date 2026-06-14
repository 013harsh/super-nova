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

// Mock imageUpload service to assert deletion of product images
jest.mock("../services/imageUpload.service", () => ({
  deleteMultipleImages: jest.fn().mockResolvedValue(),
}));

const app = require("../app");
const Product = require("../models/product.model");
const { connectTestDB, closeTestDB, clearTestDB } = require("./setup/testDb");
const { createMockProduct, generateObjectId } = require("./setup/fixtures");
const { deleteMultipleImages } = require("../services/imageUpload.service");

// Helper to convert flat fixture product to nested DB format
const toDbProduct = (mock) => ({
  title: mock.title,
  description: mock.description,
  price: { amount: mock.price, currency: mock.currency || "INR" },
  seller: mock.seller,
  images: mock.images || [],
});

describe("DELETE /api/products/:id", () => {
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
    it("should allow the seller who owns the product to successfully delete it and clean up its images", async () => {
      const sellerId = generateObjectId();
      const mockImages = [
        { url: "https://ik.imagekit.io/test/img1.jpg", thumbnailUrl: "https://ik.imagekit.io/test/thumb1.jpg", id: "file_id_1" },
        { url: "https://ik.imagekit.io/test/img2.jpg", thumbnailUrl: "https://ik.imagekit.io/test/thumb2.jpg", id: "file_id_2" }
      ];

      const mockProduct = toDbProduct(createMockProduct({ seller: sellerId, images: mockImages }));
      const savedProduct = await Product.create(mockProduct);

      // Authenticate as the seller who owns the product
      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .delete(`/api/products/${savedProduct._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/deleted successfully/i);

      // Confirm product is removed from database
      const productInDb = await Product.findById(savedProduct._id);
      expect(productInDb).toBeNull();

      // Confirm ImageKit image cleanup was invoked with product's images
      expect(deleteMultipleImages).toHaveBeenCalledTimes(1);
      expect(deleteMultipleImages).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: "file_id_1" }),
        expect.objectContaining({ id: "file_id_2" })
      ]));
    });

    it("should reject delete request with 403 Forbidden from a different seller", async () => {
      const originalSellerId = generateObjectId();
      const differentSellerId = generateObjectId();

      const mockProduct = toDbProduct(createMockProduct({ seller: originalSellerId }));
      const savedProduct = await Product.create(mockProduct);

      // Authenticate as a completely different seller
      mockUser = { id: differentSellerId, role: "seller" };

      const response = await request(app)
        .delete(`/api/products/${savedProduct._id}`)
        .expect(403);

      expect(response.body.message).toMatch(/insufficient permissions|unauthorized/i);

      // Confirm database product was NOT deleted
      const productInDb = await Product.findById(savedProduct._id);
      expect(productInDb).toBeTruthy();

      // Confirm no image cleanup was called
      expect(deleteMultipleImages).not.toHaveBeenCalled();
    });

    it("should reject delete request with 401 Unauthorized if not authenticated", async () => {
      const mockProduct = toDbProduct(createMockProduct());
      const savedProduct = await Product.create(mockProduct);

      // Unauthenticated request (mockUser remains null)
      mockUser = null;

      const response = await request(app)
        .delete(`/api/products/${savedProduct._id}`)
        .expect(401);

      expect(response.body.message).toMatch(/access denied|unauthorized/i);

      // Confirm database product was NOT deleted
      const productInDb = await Product.findById(savedProduct._id);
      expect(productInDb).toBeTruthy();
    });
  });

  describe("Edge & Error Cases", () => {
    it("should return 404 when product is not found with a valid but non-existent ObjectId", async () => {
      mockUser = { id: generateObjectId(), role: "seller" };
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .delete(`/api/products/${nonExistentId}`)
        .expect(404);

      expect(response.body.message).toBe("Product not found");
      expect(deleteMultipleImages).not.toHaveBeenCalled();
    });

    it("should return 400 or 500 when product ID format is invalid", async () => {
      mockUser = { id: generateObjectId(), role: "seller" };
      const invalidId = "invalid-id-format";

      const response = await request(app)
        .delete(`/api/products/${invalidId}`)
        .expect((res) => {
          expect([400, 500]).toContain(res.status);
        });

      expect(deleteMultipleImages).not.toHaveBeenCalled();
    });
  });
});
