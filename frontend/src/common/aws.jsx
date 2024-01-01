// aws.jsx
const CLOUD_NAME = "dgnjyq2ko";
const UPLOAD_PRESET = "sky-social-app";
const API_BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

export const uploadImage = async (file) => {
  if (file) {
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET);
      data.append("cloud_name", CLOUD_NAME);

      const uploadUrl = `${API_BASE_URL}/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: data,
      });

      const fileData = await res.json();
      console.log("Response of Cloudinary:", fileData.url);
      return fileData.url;
    } catch (error) {
      console.error("Error in Cloudinary upload:", error.message);
      throw new Error("Failed to upload file to Cloudinary");
    }
  } else {
    throw new Error("File is missing");
  }
};
