const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redis = require("../db/redis");

async function registeruser(req, res) {
  try {
    const {
      username,
      email,
      password,
      fullName: { firstname, lastname },
      role,
      addresses,
    } = req.body;

    const isUserAlreadyExist = await userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (isUserAlreadyExist) {
      return res.status(409).json({
        success: false,
        message: "User with this email or username already exists",
      });
    }
    const hash = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      username,
      email,
      password: hash,
      fullName: {
        firstname,
        lastname,
      },
      role,
      addresses,
    });
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("token", token, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error,
    });
  }
}

async function loginuser(req, res) {
  try {
    const { username, email, password } = req.body;

    const user = await userModel
      .findOne({
        $or: [{ username }, { email }],
      })
      .select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    res.cookie("token", token, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
    });
    res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        addresses: user.addresses,
      },
      token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error,
    });
  }
}

async function getcurrentuser(req, res) {
  return res.status(200).json({
    message: "Current user fetched successfully",
    user: req.user,
  });
}

async function logoutuser(req, res) {
  const token = req.cookies.token;

  if (token) {
    await redis.set(`blacklist_${token}`, "true", "EX", 60 * 60 * 24);
  }

  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
  });
  return res.status(200).json({
    success: true,
    message: "User logged out successfully",
  });
}

async function getAddresses(req, res) {
  try {
    const user = await userModel.findById(req.user.id).select("addresses");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, addresses: user.addresses });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error", error });
  }
}

// async function addAddress(req, res) {
//   try {
//     const id = req.user.id;

//     const { street, city, state, pincode, country, isDefault } = req.body;

//     const user = await userModel.findOneAndUpdate(
//       { _id: id },
//       {
//         $push: {
//           addresses: {
//             street,
//             city,
//             state,
//             pincode,
//             country,
//             isDefault,
//           },
//         },
//       },
//       { new: true },
//     );

//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Address added successfully",
//       address: user.addresses[user.addresses.length - 1],
//     });
//   } catch (error) {
//     return res
//       .status(500)
//       .json({ success: false, message: "Internal server error", error });
//   }
// }
async function addAddress(req, res) {
  try {
    const id = req.user.id;

    const { street, city, state, pincode, country, isDefault } = req.body;

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const defaultStatus = isDefault || user.addresses.length === 0;

    if (defaultStatus) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const newAddress = {
      street,
      city,
      state,
      pincode,
      country,
      isDefault: defaultStatus,
    };

    user.addresses.push(newAddress);

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: user.addresses[user.addresses.length - 1],
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

async function deleteAddress(req, res) {
  try {
    const { addressId } = req.params;

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === addressId,
    );

    if (addressIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    const wasDefault = user.addresses[addressIndex].isDefault;
    user.addresses.splice(addressIndex, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return res
      .status(200)
      .json({ success: true, message: "Address removed successfully" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error", error });
  }
}

module.exports = {
  registeruser,
  loginuser,
  getcurrentuser,
  logoutuser,
  getAddresses,
  addAddress,
  deleteAddress,
};
