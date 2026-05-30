const cartModel = require("../models/model");
const redis = require("../db/redis");

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";

async function formatCartAndCalculateTotals(cart) {
  const items = [];
  let totalAmount = 0;
  let currency = "USD";

  if (cart && cart.items && cart.items.length > 0) {
    for (const item of cart.items) {
      const productId = item.productId.toString();
      const qty = item.qty;

      try {
        const response = await fetch(
          `${PRODUCT_SERVICE_URL}/api/products/${productId}`,
        );
        if (response.ok) {
          const resData = await response.json();
          const product = resData.product;
          if (product && product.price) {
            totalAmount += product.price.amount * qty;
            currency = product.price.currency || currency;
          }
        }
      } catch (err) {
        console.error(
          `Failed to fetch product details for ${productId}:`,
          err.message,
        );
      }

      items.push({
        productId,
        quantity: qty,
      });
    }
  }

  return {
    items,
    totals: {
      amount: totalAmount,
      currency,
    },
  };
}

async function getCart(req, res) {
  try {
    const user = req.user;
    let cart = await cartModel.findOne({ user: user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          totals: {
            amount: 0,
            currency: "USD",
          },
        },
      });
    }

    const formattedCart = await formatCartAndCalculateTotals(cart);
    return res.status(200).json({
      success: true,
      data: formattedCart,
    });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
}

async function addItemTocart(req, res) {
  try {
    const user = req.user;
    const { productId, qty } = req.body;

    // Verify product existence in Product Service
    const productResponse = await fetch(
      `${PRODUCT_SERVICE_URL}/api/products/${productId}`,
    );
    if (!productResponse.ok) {
      return res.status(404).json({ message: "Product not found" });
    }

    let cart = await cartModel.findOne({ user: user._id });
    if (!cart) {
      cart = new cartModel({ user: user._id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    const currentQty = existingItemIndex >= 0 ? cart.items[existingItemIndex].qty : 0;
    const newQty = currentQty + qty;

    if (newQty > 10) {
      return res.status(400).json({ message: "insufficient stock" });
    }

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].qty = newQty;
    } else {
      cart.items.push({ productId, qty });
    }

    await cart.save();

    // Reserve soft stock in Redis
    await redis.set(`soft_stock:${productId}`, newQty);

    const formattedCart = await formatCartAndCalculateTotals(cart);

    return res.status(201).json({
      success: true,
      data: formattedCart,
    });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
}

async function updateItemTocart(req, res) {
  try {
    const user = req.user;
    const { productId } = req.params;
    const { qty } = req.body;

    if (qty > 10) {
      return res.status(400).json({ message: "insufficient stock" });
    }

    let cart = await cartModel.findOne({ user: user._id });
    if (!cart) {
      return res.status(400).json({ message: "Cart not updated" });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );
    if (existingItemIndex === -1) {
      return res.status(400).json({ message: "out of stock" });
    }

    const newQty = qty <= 0 ? 0 : qty;

    if (newQty <= 0) {
      cart.items.splice(existingItemIndex, 1);
      await redis.set(`soft_stock:${productId}`, 0);
    } else {
      cart.items[existingItemIndex].qty = newQty;
      await redis.set(`soft_stock:${productId}`, newQty);
    }

    await cart.save();

    const formattedCart = await formatCartAndCalculateTotals(cart);
    return res.status(200).json({
      success: true,
      data: formattedCart,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function removeItemTocart(req, res) {
  try {
    const user = req.user;
    const { productId } = req.params;

    let cart = await cartModel.findOne({ user: user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );
    if (existingItemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    cart.items.splice(existingItemIndex, 1);
    await cart.save();

    // Release soft stock reservation
    await redis.set(`soft_stock:${productId}`, 0);

    const formattedCart = await formatCartAndCalculateTotals(cart);
    return res.status(200).json({
      success: true,
      data: formattedCart,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function clearCart(req, res) {
  try {
    const user = req.user;
    let cart = await cartModel.findOne({ user: user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          totals: {
            amount: 0,
            currency: "USD",
          },
        },
      });
    }

    // Release soft stock reservation for all items
    for (const item of cart.items) {
      await redis.set(`soft_stock:${item.productId}`, 0);
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      data: {
        items: [],
        totals: {
          amount: 0,
          currency: "USD",
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getCart,
  addItemTocart,
  updateItemTocart,
  removeItemTocart,
  clearCart,
};
