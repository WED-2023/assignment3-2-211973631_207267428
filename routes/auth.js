var express = require("express");
var router = express.Router();
const MySql = require("../routes/utils/MySql");
const DButils = require("../routes/utils/DButils");
const bcrypt = require("bcrypt");

const { getValidCountries } = require("../routes/utils/validCountries");

router.post("/Register", async (req, res, next) => {
  try {
    const {
      username,
      firstname,
      lastname,
      country,
      password,
      confirmPassword,
      email,
    } = req.body;

    // 1. Check required fields

    if (
      !username ||
      !firstname ||
      !lastname ||
      !country ||
      !password ||
      !confirmPassword ||
      !email
    ) {
      throw { status: 400, message: "Missing required fields" };
    }

    const validCountries = getValidCountries();
    if (!validCountries.includes(country.toLowerCase())) {
      throw { status: 400, message: "Invalid country selection" };
    }

    // 3. Validate username: 3–8 letters only
    if (!/^[A-Za-z]{3,8}$/.test(username)) {
      throw {
        status: 400,
        message: "Username must be 3-8 letters only (A-Z, a-z)",
      };
    }

    // 4. Validate password: 5–10 chars, at least one number and one special character
    if (!/^(?=.*[0-9])(?=.*[^A-Za-z0-9])[\S]{5,10}$/.test(password)) {
      throw {
        status: 400,
        message:
          "Password must be 5-10 characters and include at least one number and one special character",
      };
    }

    // 5. Password match
    if (password !== confirmPassword) {
      throw { status: 400, message: "Passwords do not match" };
    }

    // 6. Check if username already exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (users.find((x) => x.username === username)) {
      throw { status: 409, message: "Username already taken" };
    }

    // 7. Hash password
    const hash_password = bcrypt.hashSync(
      password,
      parseInt(process.env.bcrypt_saltRounds)
    );

    // 8. Insert into DB
    await DButils.execQuery(
      `INSERT INTO users (username, firstname, lastname, country, password, email)
       VALUES ('${username}', '${firstname}', '${lastname}', '${country}', '${hash_password}', '${email}')`
    );

    // 9. Respond
    res.status(201).send({ message: "User created", success: true });
  } catch (error) {
    next(error);
  }
});



router.post("/Login", async (req, res, next) => {
  try {
    // check that username exists
    const users = await DButils.execQuery("SELECT username FROM users");
    if (!users.find((x) => x.username === req.body.username))
      throw { status: 401, message: "Username or Password incorrect" };

    // check that the password is correct
    const user = (
      await DButils.execQuery(
        `SELECT * FROM users WHERE username = '${req.body.username}'`
      )
    )[0];

    if (!bcrypt.compareSync(req.body.password, user.password)) {
      throw { status: 401, message: "Username or Password incorrect" };
    }

    // Set cookie
    req.session.user_id = user.user_id;
    console.log("session user_id login: " + req.session.user_id);

    // return cookie
    res.status(200).send({ message: "login succeeded " , success: true });
  } catch (error) {
    next(error);
  }
});

router.post("/Logout", function (req, res) {
  console.log("session user_id Logout: " + req.session.user_id);
  req.session.reset(); // reset the session info --> send cookie when  req.session == undefined!!
  res.send({ success: true, message: "logout succeeded" });
});

module.exports = router;