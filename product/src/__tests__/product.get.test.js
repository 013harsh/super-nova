const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Product = require("../models/product.model");
const { connectTestDB, closeTestDB, clearTestDB } = require("./setup/testDb");
const { createMockProduct, generateObjectId } = require("./setup/fixtures");

// Maps flat mock product fixture to Mongoose DB schema structure
const toDbProduct = (mock) => ({
  title: mock.title,
  description: mock.description,
  price: { amount: mock.price, currency: mock.currency || "INR" },
  seller: mock.seller,
});

describe("GET /api/products/", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    // Build/rebuild indexes, especially text index for search query 'q'
    await Product.ensureIndexes();
  });

  describe("Success Cases", () => {
    it("should retrieve all products with default limit of 20 and skip of 0", async () => {
      // Seed 25 products
      const productsData = Array.from({ length: 25 }, (_, i) =>
        createMockProduct({
          title: `Product ${i + 1}`,
          price: 10 + i,
        }),
      );
      for (const product of productsData.map(toDbProduct)) {
        await Product.create(product);
      }

      const response = await request(app).get("/api/products/").expect(200);

      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(20); // Default limit is 20
      expect(response.body.data[0].title).toBe("Product 1");
    });

    it("should support custom pagination via skip and limit query params", async () => {
      // Seed 10 products
      const productsData = Array.from({ length: 10 }, (_, i) =>
        createMockProduct({
          title: `Product ${i + 1}`,
          price: 10 + i,
        }),
      );
      for (const product of productsData.map(toDbProduct)) {
        await Product.create(product);
      }

      const response = await request(app)
        .get("/api/products/")
        .query({ skip: 2, limit: 3 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].title).toBe("Product 3");
      expect(response.body.data[1].title).toBe("Product 4");
      expect(response.body.data[2].title).toBe("Product 5");
    });

    it("should filter products by minprice correctly", async () => {
      // Seed products with different prices
      await Product.create(
        [
          createMockProduct({ title: "Cheap Item", price: 10 }),
          createMockProduct({ title: "Mid Item", price: 50 }),
          createMockProduct({ title: "Expensive Item", price: 100 }),
        ].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ minprice: 50 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      const titles = response.body.data.map((p) => p.title);
      expect(titles).toContain("Mid Item");
      expect(titles).toContain("Expensive Item");
      expect(titles).not.toContain("Cheap Item");
    });

    it("should filter products by maxprice correctly", async () => {
      // Seed products
      await Product.create(
        [
          createMockProduct({ title: "Cheap Item", price: 10 }),
          createMockProduct({ title: "Mid Item", price: 50 }),
          createMockProduct({ title: "Expensive Item", price: 100 }),
        ].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ maxprice: 50 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      const titles = response.body.data.map((p) => p.title);
      expect(titles).toContain("Cheap Item");
      expect(titles).toContain("Mid Item");
      expect(titles).not.toContain("Expensive Item");
    });

    it("should filter products by both minprice and maxprice range correctly", async () => {
      // Seed products
      await Product.create(
        [
          createMockProduct({ title: "Cheap Item", price: 10 }),
          createMockProduct({ title: "Mid Item", price: 50 }),
          createMockProduct({ title: "Expensive Item", price: 100 }),
        ].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ minprice: 20, maxprice: 80 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe("Mid Item");
    });

    it("should filter products by search query q in title or description", async () => {
      // Seed products
      await Product.create(
        [
          createMockProduct({
            title: "Special Sony Headphones",
            description: "Audio gear",
          }),
          createMockProduct({
            title: "Sony TV",
            description: "Bravia display device",
          }),
          createMockProduct({
            title: "Keyboard",
            description: "Mechanical computer keyboard",
          }),
        ].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ q: "Sony" })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      const titles = response.body.data.map((p) => p.title);
      expect(titles).toContain("Special Sony Headphones");
      expect(titles).toContain("Sony TV");
      expect(titles).not.toContain("Keyboard");
    });
  });

  describe("Empty Result Handling", () => {
    it("should return an empty array when no products match the price query", async () => {
      await Product.create(
        [
          createMockProduct({ price: 10 }),
          createMockProduct({ price: 20 }),
        ].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ minprice: 100 })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it("should return an empty array when no products match the search query q", async () => {
      await Product.create(
        [createMockProduct({ title: "Laptop" })].map(toDbProduct),
      );

      const response = await request(app)
        .get("/api/products/")
        .query({ q: "Headphones" })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it("should return an empty array when database is empty", async () => {
      const response = await request(app).get("/api/products/").expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe("GET /api/products/:id", () => {
    it("should retrieve a product by valid ID successfully", async () => {
      const mock = toDbProduct(createMockProduct({ title: "Specific Product By ID" }));
      const savedProduct = await Product.create(mock);

      const response = await request(app)
        .get(`/api/products/${savedProduct._id}`)
        .expect(200);

      expect(response.body).toHaveProperty("product");
      expect(response.body.product._id).toBe(savedProduct._id.toString());
      expect(response.body.product.title).toBe("Specific Product By ID");
    });

    it("should return 404 when product is not found with a valid but non-existent ObjectId", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const response = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .expect(404);

      expect(response.body.message).toBe("Product not found");
    });

    it("should return 500 when product ID is in an invalid format", async () => {
      const invalidId = "invalid-id-format";

      const response = await request(app)
        .get(`/api/products/${invalidId}`)
        .expect(500);

      expect(response.body).toHaveProperty("error");
    });
  });
});
