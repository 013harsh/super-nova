const request = require('supertest');
const app = require('../src/app'); 
const orderModel = require('../src/models/order.models'); // Fixed model import path
const jwt = require("jsonwebtoken");

jest.mock('../src/models/order.models');

describe('Additional Order API Endpoints', () => {
  let mockToken;
  const mockUserId = '507f1f77bcf86cd799439011';

  beforeAll(() => {
    require("dotenv").config();
    mockToken = jwt.sign(
      { id: mockUserId, role: "user" },
      process.env.JWT_SECRET || "test_secret"
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orders/:id', () => {
    const mockOrderId = '607f1f77bcf86cd799439011';

    it('should return 200 and the order', async () => {
      const mockOrder = {
        _id: mockOrderId,
        user: mockUserId,
        status: 'PENDING',
        totalPrice: { amount: 100, currency: 'INR' },
        toString: () => mockOrderId // Mocking for internal Mongoose logic if any
      };
      // Mock Mongoose document behavior for user ID comparison
      mockOrder.user = { toString: () => mockUserId };

      orderModel.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .get(`/api/orders/${mockOrderId}`)
        .set('Cookie', `token=${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.order).toBeDefined();
    });

    it('should return 404 if order is not found', async () => {
      orderModel.findById.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/orders/${mockOrderId}`)
        .set('Cookie', `token=${mockToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Order not found');
    });
  });

  describe('GET /api/orders/me', () => {
    it('should return 200 and a paginated list of orders for the user', async () => {
      const mockOrders = [{ _id: 'order_1' }, { _id: 'order_2' }];
      
      const mockFind = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockOrders)
      };
      
      orderModel.find.mockReturnValue(mockFind);
      // orderModel.countDocuments.mockResolvedValue(2); // If your controller implements this

      const res = await request(app)
        .get('/api/orders/me?page=1&limit=10')
        .set('Cookie', `token=${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.orders.length).toBe(2);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    const mockOrderId = '607f1f77bcf86cd799439011';

    it('should return 200 and cancel the order if status is PENDING', async () => {
      const mockOrder = { 
        _id: mockOrderId, 
        user: { toString: () => mockUserId }, 
        status: 'PENDING', 
        save: jest.fn().mockResolvedValue(true) 
      };
      orderModel.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/orders/${mockOrderId}/cancel`)
        .set('Cookie', `token=${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Order cancelled successfully');
      expect(mockOrder.status).toBe('CANCELLED');
    });

    it('should return 400 if order cannot be cancelled', async () => {
      const mockOrder = { 
        _id: mockOrderId, 
        user: { toString: () => mockUserId }, 
        status: 'SHIPPED', 
        save: jest.fn() 
      };
      orderModel.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/orders/${mockOrderId}/cancel`)
        .set('Cookie', `token=${mockToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot be cancelled/i);
    });
  });

  describe('PATCH /api/orders/:id', () => {
    const mockOrderId = '607f1f77bcf86cd799439011';
    const mockAddressUpdate = { 
        shippingAddress: {
            street: '123 New Street',
            city: 'New City',
            state: 'NS',
            country: 'USA'
        }
    };

    it('should return 200 and update delivery address if payment is not captured (status PENDING)', async () => {
      const mockOrder = { 
        _id: mockOrderId, 
        user: { toString: () => mockUserId }, 
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true) 
      };
      orderModel.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .patch(`/api/orders/${mockOrderId}`)
        .set('Cookie', `token=${mockToken}`)
        .send(mockAddressUpdate);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Address updated successfully');
    });

    it('should return 400 if attempting to update address after payment is captured', async () => {
      const mockOrder = { 
        _id: mockOrderId, 
        user: { toString: () => mockUserId }, 
        status: 'PAID' 
      };
      orderModel.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .patch(`/api/orders/${mockOrderId}`)
        .set('Cookie', `token=${mockToken}`)
        .send(mockAddressUpdate);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cannot update address after payment is captured/i);
    });
  });
});
