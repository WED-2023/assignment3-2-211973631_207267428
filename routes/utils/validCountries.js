const axios = require("axios");

let validCountries = [];

async function loadValidCountries() {
  try {
    
    const response = await axios.get("https://restcountries.com/v3.1/all?fields=name");
    validCountries = response.data.map((c) => c.name.common.toLowerCase());
    console.log("✅ Countries loaded");
  } catch (err) {
    console.error("❌ Failed to load countries:", err.message);
  }
}

function getValidCountries() {
  return validCountries;
}

module.exports = {
  loadValidCountries,
  getValidCountries,
};