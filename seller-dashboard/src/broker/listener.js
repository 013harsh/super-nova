const { suscribeToQueue } = require("../broker/broker");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.models");
const paymentModel = require("../models/payment.model");

module.exports = async function () {
  suscribeToQueue("AUTH_SELLER_DASHBOARD.USER_CREATED", async (user) => {
    await userModel.create(user);
  });

  suscribeToQueue(
    "PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED",
    async (product) => {
      await productModel.create(product);
    },
  );

  suscribeToQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", async (order) => {
    await orderModel.create(order);
  });

  suscribeToQueue(
    "PAYMENT_SELLER_DASHBOARD.PAYMENT_CREATED",
    async (payment) => {
      await paymentModel.create(payment);
    },
  );

  suscribeToQueue(
    "PAYMENT_SELLER_DASHBOARD.PAYMENT_UPDATE",
    async (payment) => {
      await paymentModel.findOneAndUpdate(
        { orderId: payment.orderId },
        {
          ...payment,
        },
      );
    },
  );
};
