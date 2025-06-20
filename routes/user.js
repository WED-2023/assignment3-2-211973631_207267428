var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Check if user is authenticated (no middleware required)
 */
router.get('/checkAuth', async (req, res, next) => {
  try {
    if (req.session && req.session.user_id) {
      // Check if user exists in database
      const users = await DButils.execQuery("SELECT user_id FROM users");
      if (users.find((x) => x.user_id === req.session.user_id)) {
        res.status(200).json({ authenticated: true, user_id: req.session.user_id });
      } else {
        res.status(200).json({ authenticated: false });
      }
    } else {
      res.status(200).json({ authenticated: false });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Authenticate all incoming requests by middleware
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users").then((users) => {
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});

/**
 * This path gets body with recipeId and save this recipe in the favorites list of the logged-in user
 */
router.post('/favorites', async (req,res,next) => { 
  try{
    const user_id = req.session.user_id;
    const recipe_id = req.body.recipeId;
    await user_utils.markAsFavorite(user_id,recipe_id);
    res.status(200).send("The Recipe successfully saved as favorite");
    } catch(error){
    next(error);
  }
})

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get('/favorites', async (req,res,next) => { // should be called at start of login in frontend side, so the client knows all the user's favorites and will hold them in datastructure
  // as well as having this page cached for further use, if a recipe was added to favorites then delete the page and get new one via this request
  try{
    const user_id = req.session.user_id;
    const recipes_id = await user_utils.getFavoriteRecipes(user_id);
    let recipes_id_array = [];
    recipes_id.map((element) => recipes_id_array.push(element.recipe_id)); //extracting the recipe ids into array
    // const results = await recipe_utils.getRecipesPreview(recipes_id_array);
    // res.status(200).send(results);
    res.status(200).send({ recipes_id }); // we did this change in 3.3 notice!@!@!@!@
  } catch(error){
    next(error); 
  }
});


router.post('/lastwatched', async (req, res, next) => { // same as favorites, frontend should hold datastructure of this respone and cache of the page of last watched
  try {
    const user_id = req.session.user_id;
    const amount = Number(req.body.amount);

    if (isNaN(amount) || (!Number.isInteger(amount)) || amount < -1) {
  return res.status(400).send("Invalid 'amount' in request body. Must be -1 or a positive integer.");
  }

    const recipes_id = await user_utils.getLastWatchedRecipes(user_id, amount);
    const recipes_id_array = recipes_id.map((element) => element.recipe_id); // extracting recipe ids into array
    // const results = await recipe_utils.getRecipesPreview(recipes_id_array);
    // res.status(200).send(results);
    res.status(200).send({ recipes_id_array }); // we did this change in 3.3 notice!@!@!@!@
  } catch (error) {
    next(error);
  }
});


router.get('/familyrecipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipes = await user_utils.getTwoFamilyRecipesByUser(user_id);
    res.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});




router.post("/createrecipe", async (req, res, next) => {
  try {
    if (!req.user_id) {
      return res.status(401).send({ message: "Not logged in", success: false });
    }

    await recipe_utils.createCustomRecipe(req.user_id, req.body);

    res.status(201).send({ message: "Recipe created successfully", success: true });
  } catch (error) {
    console.error("Error in /createrecipe:", error.message);
    next(error);
  }
});











router.post('/userlikes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.body.recipeId;

    if (!recipe_id) {
      return res.status(400).send({ message: "Missing recipeId in request body" });
    }

    await user_utils.likeRecipe(user_id, recipe_id);
    res.status(200).send({ message: "Recipe liked successfully" });
  } catch (error) {
    next(error);
  }
});




router.get("/myrecipes", async (req, res, next) => { 
  try {
    if (!req.user_id) {
      return res.status(401).send({ message: "Not logged in", success: false });
    }

    const recipeIds = await recipe_utils.getCustomRecipeIdsByUser(req.user_id);
    res.status(200).send({ recipe_ids: recipeIds });
  } catch (error) {
    console.error("Error in /myrecipes:", error.message);
    next(error);
  }
});


module.exports = router;
