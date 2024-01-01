import express, { json } from "express"
import mongoose from "mongoose";
import 'dotenv/config'
import bcrypt from 'bcrypt'
import { nanoid } from "nanoid"
import jwt from "jsonwebtoken"
import cors from "cors"
import admin from "firebase-admin"
import { getAuth } from "firebase-admin/auth"
import cloudinary from 'cloudinary';

import serviceAccountKey from "./reactjs-blogging-website-sky-firebase-adminsdk-vqly2-2b1333c6cd.json" assert {type: "json"}
import User from "./Schema/User.js";
import Blog from "./Schema/Blog.js";

const server = express()
let PORT = 3000;

server.use(express.json())
server.use(cors())

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey)
});


// DB Connection
mongoose.connect(process.env.DB_LOCATION, {
  autoIndex: true
})


// Route to handle image upload
server.post('/upload', async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.body.image, {
      folder: 'Blogging',
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) {
    return res.status(401).json({ error: "No access token" })
  }
  jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Access token is invalid" })
    }
    req.user = user.id
    next()
  })
}


// WHAT WE WANT TO SEND
const formateDataToSend = (user) => {
  const access_token = jwt.sign({ id: user._id }, process.env.SECRET_ACCESS_KEY)
  return {
    access_token,
    profile_img: user.personal_info.profile_img,
    username: user.personal_info.username,
    fullname: user.personal_info.fullname
  }
}

// GENERATE USERNAME 
const generateUsername = async (email) => {
  let username = email.split("@")[0]
  let usernameExist = await User.exists({ "personal_info.username": username })
    .then((result) => result)

  usernameExist ? username += nanoid().substring(0, 5) : "";
  return username;
}

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;

// SIGN-UP FUNCTION 
server.post("/signup", (req, res) => {
  let { fullname, email, password } = req.body;

  // validating the data from frontend
  if (fullname.length < 3) {
    return res.status(403).json({ error: "Fullname must be at least 3 letters long" })
  }

  if (!email.length) {
    return res.status(403).json({ error: "Enter email" })
  }

  if (!emailRegex.test(email)) {
    return res.status(403).json({ error: "Email is invalid" })
  }

  if (!passwordRegex.test(password)) {
    return res.status(403).json({ error: "Password should be 6 to 20 characters long with 1 numeric, 1 lowercase and 1 uppercase letters" })
  }

  bcrypt.hash(password, 10, async (err, hashed_password) => {
    let username = await generateUsername(email)
    let user = new User({
      personal_info: { fullname, email, password: hashed_password, username }
    })
    user.save().then((u) => {
      return res.status(200).json(formateDataToSend(u));
    }).catch((err) => {
      if (err.code == 11000) {
        return res.status(500).json({ error: "Email already exists" })
      }
      return res.status(500).json({ error: err.message })
    });
  })
})

// SIGN-IN FUNCTION
server.post("/signin", (req, res) => {
  const { email, password } = req.body;
  User.findOne({ "personal_info.email": email })
    .then((user) => {
      if (!user) {
        return res.status(403).json({ error: "Email not found" });
      }

      if (!user.google_auth) {
        bcrypt.compare(password, user.personal_info.password, (err, result) => {
          if (err) {
            return res.status(403).json({ error: "Error occurred while login, please try again!" });
          }
          if (!result) {
            return res.status(403).json({ error: "Incorrect password or email!" });
          } else {
            return res.status(200).json(formateDataToSend(user));
          }
        });
      } else {
        return res.status(403).json({ error: "Account was created using google. Try login with google." })
      }
    })
    .catch((err) => {
      console.log(err.message);
      return res.status(500).json({
        "status": 500,
        error: err.message
      });
    });
});

server.post("/google-auth", async (req, res) => {
  try {
    const { access_token } = req.body;
    const decodedUser = await getAuth().verifyIdToken(access_token);
    let { email, name } = decodedUser;

    let user = await User.findOne({ "personal_info.email": email })
      .select("personal_info.fullname personal_info.username google_auth");

    if (user) { // Login
      if (!user.google_auth) {
        return res.status(403).json({ error: "This email was signed up without Google. Please login with a password to access the account" });
      }
    } else { // Signup
      const username = await generateUsername(email);
      user = new User({
        personal_info: { fullname: name, email, username },
        google_auth: true
      });

      await user.save();
    }

    return res.status(200).json(formateDataToSend(user));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to authenticate you with Google. Try with another Google account." });
  }
});

// Create Blog
server.post('/create-blog', verifyJWT, (req, res) => {
  let authorId = req.user;
  let { title, banner, content, tags, des, draft } = req.body;
  if (!title.length) {
    return res.status(403).json({ error: "You must provide a title" })
  }

  if (!draft) {
    if (!des.length || des.length > 200) {
      return res.status(403).json({ error: "You must provide a blog description under 200 characters" })
    }
    if (!banner.length) {
      return res.status(403).json({ error: "You must provide a banner to publish the blog" })
    }
    if (!content.blocks.length) {
      return res.status(403).json({ error: "There must be some blog content to publish the blog" })
    }
    if (!tags.length || tags.length > 10) {
      return res.status(403).json({ error: "Provide tags in order to publish the blog, Maximum 10" })
    }
  }
  tags = tags.map(tag => tag.toLowerCase())
  let blog_id = title.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, '-').trim() + nanoid()
  let blog = new Blog({
    title, des, banner, content, tags, author: authorId, blog_id, draft: Boolean(draft)
  })

  blog.save().then((blog) => {
    let incrementVal = draft ? 0 : 1;
    User.findOneAndUpdate(
      { _id: authorId },
      { $inc: { "account_info.total_posts": incrementVal }, $push: { "blogs": blog._id } }
    ).then((user) => {
      return res.status(200).json({ id: blog.blog_id })
    }).catch((error) => {
      res.status(500).json({ error: "Failed to update total posts number" })
    })
  }).catch((err) => {
    return res.status(500).json({ error: err.message })
  })
})

// Creating Server
server.listen(PORT, () => {
  console.log(`Listening on port -> ${PORT}`)
})
