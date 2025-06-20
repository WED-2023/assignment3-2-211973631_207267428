const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";


/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */


async function getRecipeInformation(recipe_id) {
  recipe_id = String(recipe_id); // 🔧 Ensure it's a string

  try {
    if (recipe_id.startsWith("c_")) {
      // Fetch from custom DB
      const result = await DButils.execQuery(
        `SELECT * FROM custom_recipes WHERE id='${recipe_id}'`
      );

      if (result.length === 0) {
        throw new Error("Recipe not found in local DB");
      }

      const recipe = result[0];
      const dbLikes = await getRecipeLikesCount(recipe_id);

      return {
        data: {
          id: recipe.id,
          title: recipe.title,
          readyInMinutes: recipe.readyInMinutes,
          image: recipe.image,
          aggregateLikes: recipe.popularity + dbLikes,
          vegan: recipe.vegan === 1,
          vegetarian: recipe.vegetarian === 1,
          glutenFree: recipe.gluten_free === 1,
          servings: recipe.servings,
          extendedIngredients: recipe.extendedIngredients,
          instructions: recipe.instructions,
        },
      };
    } else {
      // Fetch from Spoonacular
      const spoonacularResponse = await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
          includeNutrition: false,
          apiKey: process.env.spooncular_apiKey,
        },
      });

      const dbLikes = await getRecipeLikesCount(recipe_id);

      const recipeData = spoonacularResponse.data;
      recipeData.aggregateLikes = (recipeData.aggregateLikes || 0) + dbLikes;

      return {
        data: recipeData
      };
    }
  } catch (error) {
    console.error("Error in getRecipeInformation:", error.message);
    throw error;
  }
}


async function getRecipeDetails(recipe_id) { // make sure in frontend to use only what you need
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree ,servings,extendedIngredients,instructions} = recipe_info.data;

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        servings: servings,
        extendedIngredients: extendedIngredients,
        instructions: instructions
    }
}



async function get3RandomRecipes() {
  try {
    const response = await axios.get(`${api_domain}/random`, {
      params: {
        number: 3,
        apiKey: process.env.spooncular_apiKey,
      },
    });

    const recipes = response.data.recipes;

    // Map and enhance with local like counts
    const enrichedRecipes = await Promise.all(
      recipes.map(async (recipe) => {
        const {
          id,
          title,
          readyInMinutes,
          image,
          aggregateLikes,
          vegan,
          vegetarian,
          glutenFree,
        } = recipe;

        const dbLikes = await getRecipeLikesCount(id);

        return {
          id,
          title,
          readyInMinutes,
          image,
          popularity: aggregateLikes + dbLikes,
          vegan,
          vegetarian,
          glutenFree,
        };
      })
    );

    return enrichedRecipes;
  } catch (err) {
    console.error("Error fetching 3 random recipes:", err.message);
    throw err;
  }
}



const DButils = require("./DButils");


async function markRecipeAsWatched(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO user_watched_recipes (user_id, recipe_id, added_at)
    VALUES ('${user_id}', '${recipe_id}', CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
  `);
}




async function searchRecipes({ name, amount, cuisine, diet, intolerance, orderBy }) { // orderBy can be either "popularity" or "time"
  if (typeof amount === "string") {
    amount = amount.trim();
  } else if (typeof amount === "undefined" || amount === null) {
    amount = "5"; // default number of recipes or whatever default you want
  } else {
    amount = String(amount);
  }

  try {
    const response = await axios.get(`${api_domain}/complexSearch`, {
      params: {
        query: name,
        number: amount,
        apiKey: process.env.spooncular_apiKey,
        cuisine,
        diet,
        intolerance,
        sort: orderBy,
        sortDirection: "desc",
      },
    });

    const recipes = response.data.results;

    // For each recipe in the results, fetch detailed info with getRecipeDetails
    const detailedRecipes = await Promise.all(
      recipes.map(recipe => getRecipeDetails(recipe.id))
    );

    return detailedRecipes;

  } catch (error) {
    console.error("Search failed:", error.message);
    throw error;
  }
}


async function createCustomRecipe(user_id, recipeData) {
  const {
    title,
    readyInMinutes,
    image,
    vegan,
    vegetarian,
    glutenFree,
    servings,
    extendedIngredients,
    instructions
  } = recipeData;

  if (!title || !readyInMinutes || !instructions) {
    throw new Error("Missing required recipe fields");
  }

  // 1. Get the current max numeric part of the id from custom_recipes
  const result = await DButils.execQuery(
    `SELECT MAX(CAST(SUBSTRING(id, 3) AS UNSIGNED)) as maxNum FROM custom_recipes WHERE id LIKE 'c_%'`
  );
  
  let maxNum = result[0].maxNum || 0; // if no records, start from 0
  const newIdNum = maxNum + 1;
  const newId = `c_${newIdNum}`;

  // Prepare the JSON string for extendedIngredients
  const extendedIngredientsStr = JSON.stringify(extendedIngredients);

  // Build and execute the insert query
  const query = `
    INSERT INTO custom_recipes (
      id, user_id, title, readyInMinutes, image, popularity,
      vegan, vegetarian, glutenFree, servings, extendedIngredients, instructions
    )
    VALUES (
      '${newId}',
      '${user_id}',
      '${title.replace(/'/g, "''")}',
      ${readyInMinutes},
      '${image ? image.replace(/'/g, "''") : ''}',
      ${0},
      ${vegan ? 1 : 0},
      ${vegetarian ? 1 : 0},
      ${glutenFree ? 1 : 0},
      ${servings || 1},
      '${extendedIngredientsStr.replace(/'/g, "''")}',
      '${instructions.replace(/'/g, "''")}'
    )
  `;

  await DButils.execQuery(query);

  return newId; // return the new ID for reference if needed
}



// OLD VERSION: Returns full recipe objects
async function getCustomRecipesByUser(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT id, title, readyInMinutes, image, popularity,
           vegan, vegetarian, glutenFree
    FROM custom_recipes
    WHERE user_id = '${user_id}'
  `);

  const recipesWithLikes = await Promise.all(
    recipes.map(async (recipe) => {
      const likeCount = await getRecipeLikesCount(recipe.id);
      return {
        id: recipe.id,
        title: recipe.title,
        readyInMinutes: recipe.readyInMinutes,
        image: recipe.image,
        popularity: recipe.popularity + likeCount,
        vegan: recipe.vegan,
        vegetarian: recipe.vegetarian,
        glutenFree: recipe.glutenFree,
      };
    })
  );

  return recipesWithLikes;
}

// NEW VERSION: Returns only recipe IDs
async function getCustomRecipeIdsByUser(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT id FROM custom_recipes WHERE user_id = '${user_id}'
  `);
  return recipes.map(r => r.id);
}


async function getRecipesPreview(recipe_ids) {
  try {
    const previewRecipes = await Promise.all(
      recipe_ids.map(async (id) => {
        const details = await getRecipeDetails(id);
        return {
          id: details.id,
          title: details.title,
          readyInMinutes: details.readyInMinutes,
          image: details.image,
          popularity: details.popularity,
          vegan: details.vegan,
          vegetarian: details.vegetarian,
          glutenFree: details.glutenFree
        };
      })
    );
    return previewRecipes;
  } catch (err) {
    console.error("Error in getRecipesPreview:", err.message);
    throw err;
  }
}

async function getRecipeLikesCount(recipe_id) {
  const result = await DButils.execQuery(`
    SELECT COUNT(*) AS like_count
    FROM user_recipe_likes
    WHERE recipe_id = '${recipe_id}'

  `);
  return result[0].like_count;
}


exports.getRecipeLikesCount = getRecipeLikesCount;
exports.getCustomRecipesByUser = getCustomRecipesByUser;
exports.getCustomRecipeIdsByUser = getCustomRecipeIdsByUser;
exports.markRecipeAsWatched = markRecipeAsWatched;
exports.getRecipeDetails = getRecipeDetails;
exports.get3RandomRecipes = get3RandomRecipes;
exports.searchRecipes = searchRecipes;
exports.createCustomRecipe = createCustomRecipe;
exports.getRecipesPreview = getRecipesPreview;