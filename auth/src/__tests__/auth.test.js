const request = require("supertest");
const app = require("../app");
const User = require("../models/user.model");
const {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
} = require("./setup/testDb");

// Setup and teardown
beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe("POST /api/auth/register", () => {
  const validUserData = {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
    fullName: {
      firstname: "John",
      lastname: "Doe",
    },
    role: "user",
  };

  describe("Successful registration", () => {
    it("should register a new user with valid data", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.user).toHaveProperty("_id");
      expect(response.body.user.username).toBe(validUserData.username);
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user).not.toHaveProperty("password");
      expect(response.body).toHaveProperty("token");
    });

    it("should hash the password before saving", async () => {
      await request(app)
        .post("/api/auth/register")
        .send(validUserData)
        .expect(201);

      const user = await User.findOne({ email: validUserData.email }).select(
        "+password",
      );
      expect(user.password).not.toBe(validUserData.password);
      expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });

    it("should set default role to 'user' if not provided", async () => {
      const userData = { ...validUserData };
      delete userData.role;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe("user");
    });

    it("should register a user with seller role", async () => {
      const sellerData = { ...validUserData, role: "seller" };

      const response = await request(app)
        .post("/api/auth/register")
        .send(sellerData)
        .expect(201);

      expect(response.body.user.role).toBe("seller");
    });

    it("should register a user with addresses", async () => {
      const userWithAddress = {
        ...validUserData,
        addresses: [
          {
            street: "123 Main St",
            city: "New York",
            state: "NY",
            zip: "10001",
            country: "USA",
          },
        ],
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userWithAddress)
        .expect(201);

      expect(response.body.user.addresses).toHaveLength(1);
      expect(response.body.user.addresses[0].city).toBe("New York");
    });

    it("should set a JWT token in cookies", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(validUserData)
        .expect(201);

      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.startsWith("token="))).toBe(true);
    });
  });

  describe("Validation errors", () => {
    it("should return 400 if username is missing", async () => {
      const userData = {
        ...validUserData,
        fullName: { ...validUserData.fullName },
      };
      delete userData.username;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "All required fields must be provided",
      );
    });

    it("should return 400 if email is missing", async () => {
      const userData = {
        ...validUserData,
        fullName: { ...validUserData.fullName },
      };
      delete userData.email;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "All required fields must be provided",
      );
    });

    it("should return 400 if password is missing", async () => {
      const userData = {
        ...validUserData,
        fullName: { ...validUserData.fullName },
      };
      delete userData.password;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "All required fields must be provided",
      );
    });

    it("should return 400 if firstname is missing", async () => {
      const userData = {
        ...validUserData,
        fullName: { ...validUserData.fullName },
      };
      delete userData.fullName.firstname;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "All required fields must be provided",
      );
    });

    it("should return 400 if lastname is missing", async () => {
      const userData = {
        ...validUserData,
        fullName: { ...validUserData.fullName },
      };
      delete userData.fullName.lastname;

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "All required fields must be provided",
      );
    });
  });

  describe("Duplicate user errors", () => {
    it("should return 409 if email already exists", async () => {
      // Register first user
      const firstResponse = await request(app)
        .post("/api/auth/register")
        .send(validUserData);

      if (firstResponse.status !== 201) {
        console.log("First registration failed:", firstResponse.body);
      }
      expect(firstResponse.status).toBe(201);

      // Try to register with same email but different username
      const duplicateEmailUser = {
        ...validUserData,
        username: "differentuser",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(duplicateEmailUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "User with this email or username already exists",
      );
    });

    it("should return 409 if username already exists", async () => {
      // Register first user
      await request(app)
        .post("/api/auth/register")
        .send(validUserData)
        .expect(201);

      // Try to register with same username but different email
      const duplicateUsernameUser = {
        ...validUserData,
        email: "different@example.com",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(duplicateUsernameUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "User with this email or username already exists",
      );
    });
  });

  describe("Database persistence", () => {
    it("should save user to database", async () => {
      await request(app)
        .post("/api/auth/register")
        .send(validUserData)
        .expect(201);

      const user = await User.findOne({ email: validUserData.email });
      expect(user).toBeDefined();
      expect(user.username).toBe(validUserData.username);
      expect(user.email).toBe(validUserData.email);
    });

    it("should save all user fields correctly", async () => {
      const userWithAllFields = {
        ...validUserData,
        addresses: [
          {
            street: "456 Oak Ave",
            city: "Los Angeles",
            state: "CA",
            zip: "90001",
            country: "USA",
          },
        ],
      };

      await request(app)
        .post("/api/auth/register")
        .send(userWithAllFields)
        .expect(201);

      const user = await User.findOne({ email: validUserData.email });
      expect(user.fullName.firstname).toBe(validUserData.fullName.firstname);
      expect(user.fullName.lastname).toBe(validUserData.fullName.lastname);
      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0].city).toBe("Los Angeles");
    });
  });
});

describe("POST /api/auth/login", () => {
  const validUserData = {
    username: "loginuser",
    email: "login@example.com",
    password: "password123",
    fullName: { firstname: "Jane", lastname: "Doe" },
  };

  beforeEach(async () => {
    // Register the user before each login test
    await request(app).post("/api/auth/register").send(validUserData);
  });

  describe("Successful login", () => {
    it("should login successfully with email and password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: validUserData.username,
          email: validUserData.email,
          password: validUserData.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User logged in successfully");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user.username).toBe(validUserData.username);
      expect(response.body).toHaveProperty("token");
    });

    it("should login successfully with username and password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: validUserData.username,
          password: validUserData.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User logged in successfully");
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe(validUserData.username);
      expect(response.body).toHaveProperty("token");
    });

    it("should set a JWT token in cookies upon login", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: validUserData.username,
          email: validUserData.email,
          password: validUserData.password,
        })
        .expect(200);

      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.startsWith("token="))).toBe(true);
    });
  });

  describe("Validation and Errors", () => {
    it("should return 404 if neither email nor username is provided", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ password: validUserData.password })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User not found");
    });

    it("should return 400 if password is missing", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ username: validUserData.username, email: validUserData.email })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
    });

    it("should return 401 for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: validUserData.username,
          email: validUserData.email,
          password: "wrongpassword123",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid password");
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistent",
          email: "nonexistent@example.com",
          password: "password123",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("User not found");
    });
  });
});

describe("GET /api/auth/me", () => {
  const validUserData = {
    username: "meuser",
    email: "me@example.com",
    password: "password123",
    fullName: { firstname: "John", lastname: "Doe" },
  };

  let token;

  beforeEach(async () => {
    // Register the user
    await request(app).post("/api/auth/register").send(validUserData);

    // Login to get the token
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: validUserData.email, password: validUserData.password });

    // Extract token from cookies or response body
    if (response.headers["set-cookie"]) {
      const tokenCookie = response.headers["set-cookie"].find((c) =>
        c.startsWith("token="),
      );
      if (tokenCookie) {
        token = tokenCookie.split(";")[0].split("=")[1];
      }
    }
    if (!token && response.body.token) {
      token = response.body.token;
    }
  });

  describe("Successful retrieval", () => {
    it("should return the user profile when authenticated", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=${token}`])
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user.username).toBe(validUserData.username);
      expect(response.body.user).not.toHaveProperty("password");
    });
  });

  describe("Authentication errors", () => {
    it("should return 401 if no token is provided", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.message).toBe("Unauthorized");
    });

    it("should return 401 if an invalid token is provided", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`token=invalid JWT Token`])
        .expect(401);

      expect(response.body.message).toBe("unauthorized");
    });
  });
});

describe("GET /api/auth/logout", () => {
  it("should logout successfully and clear the cookie", async () => {
    const response = await request(app)
      .get("/api/auth/logout")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("User logged out successfully");

    const cookies = response.headers["set-cookie"];
    expect(cookies).toBeDefined();
    
    const tokenCookie = cookies.find((cookie) => cookie.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/token=;/);
  });
});
