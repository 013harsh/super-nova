# Auth Microservice

Authentication microservice with user registration functionality.

## Features

- User registration with email and username
- Password hashing with bcrypt
- JWT token generation
- Role-based user types (user/seller)
- Address management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

3. Start the development server:
```bash
npm run dev
```

## Testing

This project uses Jest with MongoDB Memory Server for testing, which means:
- Tests run against an in-memory MongoDB instance
- No need to set up a separate test database
- Tests are isolated and don't affect your production/development database
- Fast test execution

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `src/__tests__/auth.test.js` - Tests for authentication endpoints
- `src/__tests__/setup/testDb.js` - MongoDB Memory Server configuration

### Test Coverage

The test suite covers:
- ✅ Successful user registration
- ✅ Password hashing verification
- ✅ Default role assignment
- ✅ Role-based registration (user/seller)
- ✅ Address management
- ✅ JWT token generation and cookie setting
- ✅ Input validation (missing fields)
- ✅ Duplicate user detection (email/username)
- ✅ Database persistence

## API Endpoints

### POST /api/auth/register

Register a new user.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123",
  "fullName": {
    "firstname": "John",
    "lastname": "Doe"
  },
  "role": "user",
  "addresses": [
    {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "country": "USA"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "_id": "...",
    "username": "johndoe",
    "email": "john@example.com",
    "fullName": {
      "firstname": "John",
      "lastname": "Doe"
    },
    "role": "user",
    "addresses": [...]
  },
  "token": "jwt_token_here"
}
```

**Error Responses:**

- `400 Bad Request` - Missing required fields
- `409 Conflict` - Email or username already exists
- `500 Internal Server Error` - Server error

## Project Structure

```
auth/
├── src/
│   ├── __tests__/
│   │   ├── setup/
│   │   │   └── testDb.js          # MongoDB Memory Server setup
│   │   └── auth.test.js           # Authentication tests
│   ├── controllers/
│   │   └── auth.controller.js     # Authentication logic
│   ├── db/
│   │   └── db.js                  # Database connection
│   ├── models/
│   │   └── user.model.js          # User schema
│   ├── routes/
│   │   └── auth.routes.js         # API routes
│   └── app.js                     # Express app setup
├── .env                           # Environment variables
├── .env.test                      # Test environment variables
├── jest.config.js                 # Jest configuration
├── package.json
└── Server.js                      # Server entry point
```

## Technologies

- **Express** - Web framework
- **Mongoose** - MongoDB ODM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Jest** - Testing framework
- **Supertest** - HTTP assertions
- **MongoDB Memory Server** - In-memory MongoDB for testing
