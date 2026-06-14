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

describe("GET /api/products/seller", () => {
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

  describe("Success Cases", () => {
    it("should successfully retrieve products belonging to the logged-in seller", async () => {
      const sellerId = generateObjectId();
      
      // Seed 3 products for this seller
      const sellerProducts = [
        createMockProduct({ seller: sellerId, title: "Seller Product A" }),
        createMockProduct({ seller: sellerId, title: "Seller Product B" }),
        createMockProduct({ seller: sellerId, title: "Seller Product C" })
      ].map(toDbProduct);
      await Product.create(sellerProducts);

      // Authenticate as this seller
      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .get("/api/products/seller")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(3);

      const titles = response.body.data.map(p => p.title);
      expect(titles).toContain("Seller Product A");
      expect(titles).toContain("Seller Product B");
      expect(titles).toContain("Seller Product C");
    });

    it("should return only products owned by the logged-in seller, isolating other sellers' products", async () => {
      const targetSellerId = generateObjectId();
      const otherSellerId = generateObjectId();

      // Seed target seller's product
      await Product.create(toDbProduct(createMockProduct({ seller: targetSellerId, title: "My Product" })));
      // Seed other seller's product
      await Product.create(toDbProduct(createMockProduct({ seller: otherSellerId, title: "Someone Else's Product" })));

      // Authenticate as target seller
      mockUser = { id: targetSellerId, role: "seller" };

      const response = await request(app)
        .get("/api/products/seller")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe("My Product");
      expect(response.body.data[0].seller).toBe(targetSellerId);
    });

    it("should return an empty array if the logged-in seller has no products in the database", async () => {
      const sellerId = generateObjectId();
      const otherSellerId = generateObjectId();

      // Seed product only for other seller
      await Product.create(toDbProduct(createMockProduct({ seller: otherSellerId, title: "Other Seller's Product" })));

      // Authenticate as target seller
      mockUser = { id: sellerId, role: "seller" };

      const response = await request(app)
        .get("/api/products/seller")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe("Authentication & Authorization Cases", () => {
    it("should reject request with 403 Forbidden if user's role is not a seller", async () => {
      const customerId = generateObjectId();
      
      // Authenticate as a normal customer/user role
      mockUser = { id: customerId, role: "user" };

      const response = await request(app)
        .get("/api/products/seller")
        .expect(403);

      expect(response.body.message).toMatch(/insufficient permissions|access denied/i);
    });

    it("should reject request with 401 Unauthorized if user is not authenticated", async () => {
      // Leave mockUser as null (unauthenticated)
      mockUser = null;

      const response = await request(app)
        .get("/api/products/seller")
        .expect(401);

      expect(response.body.message).toMatch(/access denied|unauthorized/i);
    });
  });
});
