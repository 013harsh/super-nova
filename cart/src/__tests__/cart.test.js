const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const RedisMock = require("ioredis-mock");

// We initialize a Redis mock connection to assert on soft stock reservation states
const mockRedis = new RedisMock();

// Mock Redis connection helper so the app uses our mock redis during tests
jest.mock("../db/redis", () => {
  return mockRedis;
});

const app = require("../app");
const { connectTestDB, closeTestDB, clearTestDB } = require("./setup/testDb");

// A helper secret for creating valid JWT test tokens
const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_for_testing";

// Helper to generate an authentication cookie for testing
function generateAuthToken(userId) {
  // We include both id and _id to support whichever identifier convention you use in controllers/middleware
  return jwt.sign({ id: userId, _id: userId, role: "user" }, JWT_SECRET);
}

describe("Cart Service API Tests", () => {
  let testUserId;
  let authToken;
  let mockProduct1Id;
  let mockProduct2Id;

  beforeAll(async () => {
    await connectTestDB();

    // Polyfill or mock global.fetch if not already present, to prevent network requests
    if (!global.fetch) {
      global.fetch = jest.fn();
    }
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await mockRedis.flushall();
    jest.clearAllMocks();

    testUserId = new mongoose.Types.ObjectId().toString();
    authToken = generateAuthToken(testUserId);

    mockProduct1Id = new mongoose.Types.ObjectId().toString();
    mockProduct2Id = new mongoose.Types.ObjectId().toString();

    // Mock global.fetch responses for calls to Product Service (default behavior)
    jest.spyOn(global, "fetch").mockImplementation((url) => {
      if (url.includes(`/api/products/${mockProduct1Id}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              product: {
                _id: mockProduct1Id,
                title: "Premium Wireless Headphones",
                price: { amount: 150, currency: "USD" },
              },
            }),
        });
      }
      if (url.includes(`/api/products/${mockProduct2Id}`)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              product: {
                _id: mockProduct2Id,
                title: "Mechanical Gaming Keyboard",
                price: { amount: 80, currency: "USD" },
              },
            }),
        });
      }
      // Product not found
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Product not found" }),
      });
    });
  });

  describe("Authentication Guard", () => {
    it("should return 401 Unauthorized for GET /api/cart without token", async () => {
      const response = await request(app).get("/api/cart").expect(401);
      expect(response.body).toHaveProperty("message");
    });

    it("should return 401 Unauthorized for POST /api/cart/items without token", async () => {
      await request(app)
        .post("/api/cart/items")
        .send({ productId: mockProduct1Id, qty: 2 })
        .expect(401);
    });

    it("should return 401 Unauthorized for PATCH /api/cart/items/:productId without token", async () => {
      await request(app)
        .patch(`/api/cart/items/${mockProduct1Id}`)
        .send({ qty: 5 })
        .expect(401);
    });

    it("should return 401 Unauthorized for DELETE /api/cart/items/:productId without token", async () => {
      await request(app)
        .delete(`/api/cart/items/${mockProduct1Id}`)
        .expect(401);
    });

    it("should return 401 Unauthorized for DELETE /api/cart without token", async () => {
      await request(app).delete("/api/cart").expect(401);
    });
  });

  describe("GET /api/cart", () => {
    it("should return an empty cart if none exists for the user", async () => {
      const response = await request(app)
        .get("/api/cart")
        .set("Cookie", `token=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.totals.amount).toBe(0);
      expect(response.body.data.totals.currency).toBe("USD"); // Or default currency
    });
  });

  describe("POST /api/cart/items", () => {
    it("should reject adding an item if product is not found in Product Service", async () => {
      const invalidProductId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: invalidProductId, qty: 2 })
        .expect(404);

      expect(response.body.message).toMatch(/product not found/i);
    });

    it("should reject adding item if quantity is negative or invalid", async () => {
      const response = await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: -1 })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should successfully add item and reserve soft stock in Redis", async () => {
      const response = await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(mockProduct1Id);
      expect(response.body.data.items[0].quantity).toBe(3);

      // Verify price recomputation: 3 * $150 = $450
      expect(response.body.data.totals.amount).toBe(450);
      expect(response.body.data.totals.currency).toBe("USD");

      // Soft stock verification in Redis: check if stock reservation exists
      // Assuming reservation is stored as: soft_stock:{productId} or similar key
      const keys = await mockRedis.keys("*");
      expect(keys.length).toBeGreaterThan(0);

      // The soft stock value should be updated
      const softStockKey = keys.find((k) => k.includes(mockProduct1Id));
      expect(softStockKey).toBeDefined();
      const reservedAmount = await mockRedis.get(softStockKey);
      expect(Number(reservedAmount)).toBe(3);
    });

    it("should optionally reserve soft stock and reject if requested quantity exceeds virtual limit of 10", async () => {
      // Trying to add 11 items of mockProduct1
      const response = await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 11 })
        .expect(400);

      expect(response.body.message).toMatch(
        /insufficient stock|out of stock|limit exceeded/i,
      );
    });

    it("should accumulate quantities when same product is added multiple times", async () => {
      // First add
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 2 })
        .expect(201);

      // Second add
      const response = await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 3 })
        .expect(201);

      expect(response.body.data.items[0].quantity).toBe(5);
      expect(response.body.data.totals.amount).toBe(750); // 5 * 150
    });
  });

  describe("PATCH /api/cart/items/:productId", () => {
    beforeEach(async () => {
      // Pre-populate cart with an item for tests
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 2 });
    });

    it("should update item quantity and recalculate totals", async () => {
      const response = await request(app)
        .patch(`/api/cart/items/${mockProduct1Id}`)
        .set("Cookie", `token=${authToken}`)
        .send({ qty: 4 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].quantity).toBe(4);
      expect(response.body.data.totals.amount).toBe(600); // 4 * 150 = 600

      // Verify Redis reservation is adjusted
      const keys = await mockRedis.keys("*");
      const softStockKey = keys.find((k) => k.includes(mockProduct1Id));
      const reservedAmount = await mockRedis.get(softStockKey);
      expect(Number(reservedAmount)).toBe(4);
    });

    it("should remove item completely if quantity is 0 or negative", async () => {
      const response = await request(app)
        .patch(`/api/cart/items/${mockProduct1Id}`)
        .set("Cookie", `token=${authToken}`)
        .send({ qty: 0 })
        .expect(200);

      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.totals.amount).toBe(0);

      // Verify Redis reservation is released
      const keys = await mockRedis.keys("*");
      const softStockKey = keys.find((k) => k.includes(mockProduct1Id));
      if (softStockKey) {
        const reservedAmount = await mockRedis.get(softStockKey);
        expect(Number(reservedAmount || 0)).toBe(0);
      }
    });

    it("should reject quantity update if it exceeds soft stock virtual limit of 10", async () => {
      const response = await request(app)
        .patch(`/api/cart/items/${mockProduct1Id}`)
        .set("Cookie", `token=${authToken}`)
        .send({ qty: 15 })
        .expect(400);

      expect(response.body.message).toMatch(
        /insufficient stock|out of stock|limit exceeded/i,
      );
    });
  });

  describe("DELETE /api/cart/items/:productId", () => {
    beforeEach(async () => {
      // Add product 1 and product 2 to the cart
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 2 });

      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct2Id, qty: 1 });
    });

    it("should remove item line and recalculate totals based on remaining items", async () => {
      // Cart before delete: 2 * 150 (300) + 1 * 80 (80) = 380
      const response = await request(app)
        .delete(`/api/cart/items/${mockProduct1Id}`)
        .set("Cookie", `token=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productId).toBe(mockProduct2Id);
      expect(response.body.data.totals.amount).toBe(80); // only mechanical keyboard remaining

      // Verify soft stock reservation for mockProduct1 is released
      const keys = await mockRedis.keys("*");
      const softStockKey = keys.find((k) => k.includes(mockProduct1Id));
      if (softStockKey) {
        const reservedAmount = await mockRedis.get(softStockKey);
        expect(Number(reservedAmount || 0)).toBe(0);
      }
    });
  });

  describe("DELETE /api/cart", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct1Id, qty: 2 });

      await request(app)
        .post("/api/cart/items")
        .set("Cookie", `token=${authToken}`)
        .send({ productId: mockProduct2Id, qty: 3 });
    });

    it("should clear all items in the cart and release all soft stock reservations", async () => {
      const response = await request(app)
        .delete("/api/cart")
        .set("Cookie", `token=${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.totals.amount).toBe(0);

      // Verify all soft stock reservations are fully released/cleaned up
      const keys = await mockRedis.keys("*");
      for (const key of keys) {
        const value = await mockRedis.get(key);
        expect(Number(value || 0)).toBe(0);
      }
    });
  });
});
