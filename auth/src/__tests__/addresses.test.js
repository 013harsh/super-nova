const request = require("supertest");
const app = require("../app");
const User = require("../models/user.model");
const {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
} = require("./setup/testDb");

beforeAll(async () => {
  await connectTestDB();
});
afterAll(async () => {
  await disconnectTestDB();
});
beforeEach(async () => {
  await clearTestDB();
});

const BASE_USER = {
  username: "addruser",
  email: "addr@example.com",
  password: "password123",
  fullName: { firstname: "Addr", lastname: "User" },
};

const VALID_ADDRESS = {
  street: "42 Baker Street",
  city: "Mumbai",
  state: "MH",
  country: "India",
  pincode: "400001",
};

const FAKE_OBJECT_ID = "000000000000000000000001";

const api = {
  register: (data = BASE_USER) =>
    request(app).post("/api/auth/register").send(data),

  login: (data) => request(app).post("/api/auth/login").send(data),

  getAddresses: (token) =>
    request(app)
      .get("/api/auth/me/addresses")
      .set("Cookie", [`token=${token}`]),

  addAddress: (token, body = VALID_ADDRESS) =>
    request(app)
      .post("/api/auth/me/addresses")
      .set("Cookie", [`token=${token}`])
      .send(body),

  deleteAddress: (token, id) =>
    request(app)
      .delete(`/api/auth/me/addresses/${id}`)
      .set("Cookie", [`token=${token}`]),
};

/** Register + login; return JWT string. */
async function registerAndLogin(user = BASE_USER) {
  await api.register(user).expect(201);
  const res = await api
    .login({ email: user.email, password: user.password })
    .expect(200);
  return res.body.token ?? extractTokenFromCookie(res);
}

function extractTokenFromCookie(res) {
  const cookie = (res.headers["set-cookie"] ?? []).find((c) =>
    c.startsWith("token="),
  );
  return cookie?.split(";")[0].split("=")[1];
}

function authGuardSuite(unauthenticated, invalidToken) {
  it("should return 401 when no token is provided", async () => {
    const res = await unauthenticated();
    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });

  it("should return 401 when an invalid token is provided", async () => {
    const res = await invalidToken();
    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });
}

describe("GET /api/auth/me/addresses", () => {
  let token;
  beforeEach(async () => {
    token = await registerAndLogin();
  });

  describe("Authentication guard", () => {
    authGuardSuite(
      () => request(app).get("/api/auth/me/addresses"),
      () =>
        request(app)
          .get("/api/auth/me/addresses")
          .set("Cookie", ["token=invalid.jwt.token"]),
    );
  });

  it("should return an empty array when the user has no addresses", async () => {
    const res = await api.getAddresses(token).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.addresses).toEqual([]);
  });

  describe("With existing addresses", () => {
    beforeEach(async () => {
      await api.addAddress(token);
      await api.addAddress(token, {
        ...VALID_ADDRESS,
        city: "Delhi",
        pincode: "110001",
      });
    });

    it("should return all addresses belonging to the authenticated user", async () => {
      const res = await api.getAddresses(token).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.addresses).toHaveLength(2);
    });

    it("should include all address fields in the response", async () => {
      const res = await api.getAddresses(token).expect(200);
      const addr = res.body.addresses[0];
      expect(addr).toHaveProperty("_id");
      expect(addr.street).toBe(VALID_ADDRESS.street);
      expect(addr.pincode).toBe(VALID_ADDRESS.pincode);
    });
  });

  it("should mark the first address as default automatically", async () => {
    await api.addAddress(token);
    const res = await api.getAddresses(token).expect(200);
    expect(res.body.addresses[0].isDefault).toBe(true);
  });

  it("should not return addresses of a different user", async () => {
    await api.addAddress(token); // user1 has one address

    const token2 = await registerAndLogin({
      username: "otheruser",
      email: "other@example.com",
      password: "password123",
      fullName: { firstname: "Other", lastname: "User" },
    });

    const res = await api.getAddresses(token2).expect(200);
    expect(res.body.addresses).toHaveLength(0);
  });
});

describe("POST /api/auth/me/addresses", () => {
  let token;
  beforeEach(async () => {
    token = await registerAndLogin();
  });

  describe("Authentication guard", () => {
    authGuardSuite(
      () => request(app).post("/api/auth/me/addresses").send(VALID_ADDRESS),
      () =>
        request(app)
          .post("/api/auth/me/addresses")
          .set("Cookie", ["token=bad.token.here"])
          .send(VALID_ADDRESS),
    );
  });

  describe("Successful addition", () => {
    it("should add a valid address and return 201", async () => {
      const res = await api.addAddress(token).expect(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Address added successfully");
      expect(res.body.address).toHaveProperty("_id");
    });

    it("should persist the address in the database", async () => {
      await api.addAddress(token).expect(201);
      const user = await User.findOne({ email: BASE_USER.email });
      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0].city).toBe(VALID_ADDRESS.city);
    });

    it("should auto-set isDefault=true for the very first address", async () => {
      const res = await api.addAddress(token).expect(201);
      expect(res.body.address.isDefault).toBe(true);
    });

    it("should NOT auto-set isDefault for a second address added without the flag", async () => {
      await api.addAddress(token);
      const res = await api
        .addAddress(token, {
          ...VALID_ADDRESS,
          city: "Pune",
          pincode: "411001",
        })
        .expect(201);
      expect(res.body.address.isDefault).toBe(false);
    });

    it("should demote previous default when a new address is marked isDefault=true", async () => {
      await api.addAddress(token);
      await api.addAddress(token, {
        ...VALID_ADDRESS,
        city: "Pune",
        pincode: "411001",
        isDefault: true,
      });

      const res = await api.getAddresses(token);
      const defaults = res.body.addresses.filter((a) => a.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].city).toBe("Pune");
    });

    it("should add an address without optional pincode field", async () => {
      const res = await api
        .addAddress(token, {
          street: "1 Hill Rd",
          city: "Goa",
          state: "GA",
          country: "India",
        })
        .expect(201);
      expect(res.body.success).toBe(true);
    });
  });

  async function expectValidationError(override, pattern) {
    const res = await api
      .addAddress(token, { ...VALID_ADDRESS, ...override })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(pattern);
  }

  describe("Pincode validation", () => {
    it("should reject a pincode shorter than 6 digits", () =>
      expectValidationError({ pincode: "4000" }, /pincode/i));
    it("should reject a pincode longer than 6 digits", () =>
      expectValidationError({ pincode: "4000019" }, /pincode/i));
    it("should reject a pincode with non-numeric chars", () =>
      expectValidationError({ pincode: "4A0001" }, /pincode/i));

    it("should accept a valid 6-digit pincode", async () => {
      const res = await api
        .addAddress(token, { ...VALID_ADDRESS, pincode: "560001" })
        .expect(201);
      expect(res.body.address.pincode).toBe("560001");
    });
  });
});

describe("DELETE /api/auth/me/addresses/:addressId", () => {
  let token;
  beforeEach(async () => {
    token = await registerAndLogin();
  });

  describe("Authentication guard", () => {
    authGuardSuite(
      () => request(app).delete(`/api/auth/me/addresses/${FAKE_OBJECT_ID}`),
      () =>
        request(app)
          .delete(`/api/auth/me/addresses/${FAKE_OBJECT_ID}`)
          .set("Cookie", ["token=bad.token"]),
    );
  });

  describe("Successful deletion", () => {
    let addressId;
    beforeEach(async () => {
      const res = await api.addAddress(token).expect(201);
      addressId = res.body.address._id;
    });

    it("should delete an existing address and return 200", async () => {
      const res = await api.deleteAddress(token, addressId).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Address removed successfully");
    });

    it("should remove the address from the database", async () => {
      await api.deleteAddress(token, addressId);
      const user = await User.findOne({ email: BASE_USER.email });
      expect(user.addresses).toHaveLength(0);
    });

    it("should reduce the address count by 1 when one of two addresses is deleted", async () => {
      const add2 = await api.addAddress(token, {
        ...VALID_ADDRESS,
        city: "Pune",
        pincode: "411001",
      });
      await api.deleteAddress(token, add2.body.address._id).expect(200);

      const res = await api.getAddresses(token);
      expect(res.body.addresses).toHaveLength(1);
    });
  });

  describe("Default address promotion", () => {
    it("should promote the next address to default when the default is deleted", async () => {
      const add1 = await api.addAddress(token); // default
      await api.addAddress(token, {
        ...VALID_ADDRESS,
        city: "Pune",
        pincode: "411001",
      }); // non-default

      await api.deleteAddress(token, add1.body.address._id).expect(200);

      const res = await api.getAddresses(token);
      expect(res.body.addresses).toHaveLength(1);
      expect(res.body.addresses[0].isDefault).toBe(true);
      expect(res.body.addresses[0].city).toBe("Pune");
    });

    it("should NOT change the default when a non-default address is deleted", async () => {
      await api.addAddress(token); // default
      const add2 = await api.addAddress(token, {
        ...VALID_ADDRESS,
        city: "Pune",
        pincode: "411001",
      }); // non-default

      await api.deleteAddress(token, add2.body.address._id).expect(200);

      const res = await api.getAddresses(token);
      expect(res.body.addresses[0].isDefault).toBe(true);
      expect(res.body.addresses[0].city).toBe(VALID_ADDRESS.city);
    });
  });

  describe("Error cases", () => {
    it("should return 404 when the addressId does not exist", async () => {
      const res = await api.deleteAddress(token, FAKE_OBJECT_ID).expect(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Address not found");
    });

    it("should not allow a user to delete another user's address", async () => {
      const add = await api.addAddress(token); // user1's address

      const token2 = await registerAndLogin({
        username: "otheruser2",
        email: "other2@example.com",
        password: "password123",
        fullName: { firstname: "Other", lastname: "Two" },
      });

      const res = await api
        .deleteAddress(token2, add.body.address._id)
        .expect(404);
      expect(res.body.success).toBe(false);
    });
  });
});
