const { tool } = require("@langchain/core/tools");
const axios = require("axios");
const { z } = require("zod");

const searchProduct = tool(
  async ({ query, token }) => {
    const response = await axios.get(
      `http://localhost:3001/api/products?q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return JSON.stringify(response.data);
  },
  {
    name: "searchProduct",
    description: "search for product based on a query",
    schema: z.object({
      query: z.string().describe("the search query for product"),
    }),
  },
);

const addProductToCart = tool(
  async ({ productId, qty = 1, token }) => {
    try {
      const response = await axios.post(
        `http://localhost:3002/api/cart/items`,
        { productId, qty },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      return `Added Product with Id ${productId} and QTY ${qty} to cart`;
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  },
  {
    name: "addProductToCart",
    description: "add product to cart",
    schema: z.object({
      productId: z.string().describe("the product id to be added to cart"),
      qty: z
        .number()
        .describe("the qty of the product to be added to cart")
        .default(1),
    }),
  },
);

// const getCart = tool(
//   async ({ token }) => {
//     try {
//       const response = await axios.get("http://localhost:3001/api/cart", {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
//       return JSON.stringify(response.data);
//     } catch (error) {
//       return JSON.stringify({ error: error.message });
//     }
//   },
//   {
//     name: "getCart",
//     description: "get the cart for the user",
//   },
// );

module.exports = {
  searchProduct,
  addProductToCart,
};
