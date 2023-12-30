import express, { json } from "express"
import mongoose from "mongoose";
import 'dotenv/config'
import bcrypt from 'bcrypt'
import { nanoid } from "nanoid"
import jwt from "jsonwebtoken"
import cors from "cors"
import admin from "firebase-admin"
import { getAuth } from "firebase-admin/auth"
import serviceAccountKey from "./reactjs-blogging-website-sky-firebase-adminsdk-vqly2-2b1333c6cd.json" assert {type: "json"}

// Schema below
import User from "./Schema/User.js";

const server = express()
let PORT = 3000;

server.use(express.json())
server.use(cors())

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey)
});

// regex for email and password
let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;

// DB Connection
mongoose.connect(process.env.DB_LOCATION, {
  autoIndex: true
})

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

// SIGN-UP FUNCTION 
server.post("/signup", (req, res) => {
  let { fullname, email, password } = req.body;

  // validating the data from frontend
  if (fullname.length < 3) {
    return res.status(403).json({ "error": "Fullname must be at least 3 letters long" })
  }

  if (!email.length) {
    return res.status(403).json({ "error": "Enter email" })
  }

  if (!emailRegex.test(email)) {
    return res.status(403).json({ "error": "Email is invalid" })
  }

  if (!passwordRegex.test(password)) {
    return res.status(403).json({ "error": "Password should be 6 to 20 characters long with 1 numeric, 1 lowercase and 1 uppercase letters" })
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
        return res.status(500).json({ "error": "Email already exists" })
      }
      return res.status(500).json({ "error": err.message })
    });
  })
})

// SIGN-IN FUNCTION
server.post("/signin", (req, res) => {
  const { email, password } = req.body;
  User.findOne({ "personal_info.email": email })
    .then((user) => {
      if (!user) {
        return res.status(403).json({ "error": "Email not found" });
      }

      if (!user.google_auth) {
        bcrypt.compare(password, user.personal_info.password, (err, result) => {
          if (err) {
            return res.status(403).json({ "error": "Error occurred while login, please try again!" });
          }
          if (!result) {
            return res.status(403).json({ "error": "Incorrect password or email!" });
          } else {
            return res.status(200).json(formateDataToSend(user));
          }
        });
      } else {
        return res.status(403).json({ "error": "Account was created using google. Try login with google." })
      }
    })
    .catch((err) => {
      console.log(err.message);
      return res.status(500).json({
        "status": 500,
        "error": err.message
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
        return res.status(403).json({ "error": "This email was signed up without Google. Please login with a password to access the account" });
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
    return res.status(500).json({ "error": err.message || "Failed to authenticate you with Google. Try with another Google account." });
  }
});

// Creating Server
server.listen(PORT, () => {
  console.log(`Listening on port -> ${PORT}`)
})
