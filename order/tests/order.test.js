const request = require("supertest");
const app = require("../src/app");
const dbHandler = require("./mongodb");
const axios = require("axios");

jest.mock("axios");

describe("POST /api/orders", () => {
  let userToken;
  const jwt = require("jsonwebtoken");

  beforeAll(async () => {
    require("dotenv").config();
    await dbHandler.connect();

    userToken = jwt.sign(
      { id: "507f1f77bcf86cd799439011", role: "user" },
      process.env.JWT_SECRET
    );
  });

  beforeEach(async () => {
    await dbHandler.clearDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbHandler.closeDatabase();
  });

  it("should successfully create an order from the current cart", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("cart")) {
        return { data: { cart: { items: [{ productId: "507f1f77bcf86cd799439012", quantity: 2, qty: 2 }] } } };
      }
      if (url.includes("products/507f1f77bcf86cd799439012")) {
        return { data: { product: { _id: "507f1f77bcf86cd799439012", price: { amount: 100, currency: "INR" }, stock: 10 } } };
      }
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${userToken}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.order).toHaveProperty("_id");
    expect(response.body.order.status).toBe("PENDING");
    expect(response.body.order.items).toBeInstanceOf(Array);
    expect(response.body.order.items.length).toBeGreaterThan(0);
    expect(response.body.order.totalPrice).toHaveProperty("amount");
  });

  it("should handle empty cart gracefully", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("cart")) {
        return { data: { cart: { items: [] } } };
      }
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${userToken}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.order.items.length).toBe(0);
  });

  it("should return 500 if inventory reservation fails due to out of stock items", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("cart")) {
        return { data: { cart: { items: [{ productId: "507f1f77bcf86cd799439012", quantity: 20, qty: 20 }] } } };
      }
      if (url.includes("products/507f1f77bcf86cd799439012")) {
        return { data: { product: { _id: "507f1f77bcf86cd799439012", price: { amount: 100, currency: "INR" }, stock: 10, title: "Phone" } } };
      }
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${userToken}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
        },
      });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });

  it("should correctly compute orderTotal based on items in the cart", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("cart")) {
        return { data: { cart: { items: [{ productId: "507f1f77bcf86cd799439012", quantity: 2, qty: 2 }] } } };
      }
      if (url.includes("products/507f1f77bcf86cd799439012")) {
        return { data: { product: { _id: "507f1f77bcf86cd799439012", price: { amount: 100, currency: "INR" }, stock: 10 } } };
      }
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${userToken}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.order.totalPrice.amount).toBe(200);
  });

  it("should copy priced items with their historical prices to prevent future price changes affecting the order", async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes("cart")) {
        return { data: { cart: { items: [{ productId: "507f1f77bcf86cd799439012", quantity: 2, qty: 2 }] } } };
      }
      if (url.includes("products/507f1f77bcf86cd799439012")) {
        return { data: { product: { _id: "507f1f77bcf86cd799439012", price: { amount: 100, currency: "INR" }, stock: 10 } } };
      }
    });

    const response = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${userToken}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Metropolis",
          state: "NY",
          country: "USA",
        },
      });

    expect(response.status).toBe(201);
    const orderItems = response.body.order.items;
    orderItems.forEach((item) => {
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("product");
      expect(item).toHaveProperty("quantity");
    });
  });
});
