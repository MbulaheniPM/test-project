const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";

async function fetchWeather() {
  const url = new URL(WEATHER_API_URL);
  url.search = new URLSearchParams({
    latitude: "-26.20",
    longitude: "28.04",
    hourly: "global_tilted_irradiance,temperature_2m,wind_speed_100m",
    tilt: "30",
    azimuth: "180",
    timezone: "Africa/Johannesburg",
    // Two days let the dashboard show 24 hours from the current local hour.
    forecast_days: "2",
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather service returned HTTP ${response.status}.`);
  }

  const data = await response.json();
  if (!data.hourly || typeof data.hourly !== "object") {
    throw new Error("Weather service response did not include hourly data.");
  }

  return data.hourly;
}

window.WeatherAPI = Object.freeze({ fetchWeather });
