const imagekit = require("../config/imagekit.config");
const { v4: uuidv4 } = require("uuid");

const uploadSingleImage = async (
  fileBuffer,
  fileName,
  folder = "/products",
) => {
  try {
    const uploadResponse = await imagekit.upload({
      file: fileBuffer,
      fileName: uuidv4(),
      folder: folder,
    });

    return {
      url: uploadResponse.url,
      thumbnailUrl: uploadResponse.thumbnailUrl,
      id: uploadResponse.fileId,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`Error uploading image ${fileName}:`, error);
    }
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

const uploadMultipleImages = async (files, folder = "/products") => {
  if (!files || files.length === 0) {
    return [];
  }

  try {
    const uploadPromises = files.map((file) =>
      uploadSingleImage(file.buffer, file.originalname, folder),
    );

    const uploadedImages = await Promise.all(uploadPromises);
    return uploadedImages;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Error uploading multiple images:", error);
    }
    throw error;
  }
};

const deleteImage = async (fileId) => {
  try {
    await imagekit.deleteFile(fileId);
    console.log(`Image ${fileId} deleted successfully`);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`Error deleting image ${fileId}:`, error);
    }
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

const deleteMultipleImages = async (fileIds) => {
  if (!fileIds || fileIds.length === 0) {
    return;
  }

  try {
    const deletePromises = fileIds.map((fileId) => deleteImage(fileId));
    await Promise.all(deletePromises);
    if (process.env.NODE_ENV !== "test") {
      console.log(`${fileIds.length} images deleted successfully`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Error deleting multiple images:", error);
    }
    throw error;
  }
};

const getImageDetails = async (fileId) => {
  try {
    const details = await imagekit.getFileDetails(fileId);
    return details;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`Error getting image details for ${fileId}:`, error);
    }
    throw new Error(`Failed to get image details: ${error.message}`);
  }
};

const updateImageDetails = async (fileId, updates) => {
  try {
    const updatedDetails = await imagekit.updateFileDetails(fileId, updates);
    return updatedDetails;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`Error updating image ${fileId}:`, error);
    }
    throw new Error(`Failed to update image: ${error.message}`);
  }
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  getImageDetails,
  updateImageDetails,
};
