const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id) {
  await DButils.execQuery(
    `INSERT INTO user_favorite_recipes VALUES ('${user_id}', '${recipe_id}')`
  );
}


async function getFavoriteRecipes(user_id){
    const recipes_id = await DButils.execQuery(`select recipe_id from user_favorite_recipes where user_id='${user_id}'`);
    return recipes_id;
}

async function getLastWatchedRecipes(user_id, amount) {
  try {
    let query = `
      SELECT recipe_id
      FROM user_watched_recipes
      WHERE user_id = '${user_id}'
      ORDER BY added_at DESC
    `;

    // Only add LIMIT if amount is a positive number
    if (!isNaN(amount) && Number(amount) > 0) {
      query += ` LIMIT ${amount}`;
    }
    // If amount is -1 or any non-positive number, skip LIMIT (unlimited)

    const watchedRecipes = await DButils.execQuery(query);
    return watchedRecipes;
  } catch (error) {
    throw error;
  }
}



async function isTestUser(user_id) {
  const result = await DButils.execQuery(`SELECT username FROM users WHERE user_id='${user_id}'`);
  return user_id === 12 && result.length > 0 && result[0].username === "omertop";
}

async function likeRecipe(user_id, recipe_id) {
  await DButils.execQuery(`
    INSERT INTO user_recipe_likes (user_id, recipe_id)
    VALUES ('${user_id}', '${recipe_id}')
    ON DUPLICATE KEY UPDATE recipe_id = recipe_id
  `);
}


exports.likeRecipe = likeRecipe;
exports.getLastWatchedRecipes = getLastWatchedRecipes;
exports.isTestUser = isTestUser;
exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
