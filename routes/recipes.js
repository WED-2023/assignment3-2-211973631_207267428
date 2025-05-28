var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");

router.get("/", (req, res) => res.send("im here"));

// IMPORTANT: make sure that in frontend, when the user gets a good response he will add it to its "last watched"@@@@@@@@@@@@@@@@@

// also make sure this method works for custom recipes!!
router.get("/getfullrecipeId", async (req, res, next) => { 
  try {
    const recipeId = req.query.recipeId;  // get from query string, e.g. /getfullrecipeId?recipeId=123
    if (!recipeId) {
      return res.status(400).send({ message: "Missing recipeId query parameter" });
    }
    const recipe = await recipes_utils.getRecipeDetails(recipeId);

    if (req.user_id) {
    await recipes_utils.markRecipeAsWatched(req.user_id, recipeId);
    }
    
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});


router.get("/searchrecipe", async (req, res, next) => {
  try {
    const {
      amount = 5,
      name,
      cuisine,
      diet,
      intolerance,
      orderBy,
    } = req.query;

    if (!name) {
      return res.status(400).send({ message: "Missing required parameter: name" });
    }

    const results = await recipes_utils.searchRecipes({
      name,
      amount,
      cuisine,
      diet,
      intolerance,
      orderBy,
    });

    res.status(200).send(results);
  } catch (error) {
    console.error("Search failed:", error.message);
    next(error);
  }
});




router.get("/get3random", async (req, res, next) => {
  try {
    const randomRecipes = await recipes_utils.get3RandomRecipes();
    res.status(200).send(randomRecipes);
  } catch (error) {
    next(error);
  }
});



/**
 * This path returns a full details of a recipe by its id
 */
// Specific routes first
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});


module.exports = router;
