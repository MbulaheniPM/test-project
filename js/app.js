const JOHANNESBURG_TIME_ZONE = "Africa/Johannesburg";
const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

const elements = {
  solarOutput: document.querySelector("#solar-output"),
  windOutput: document.querySelector("#wind-output"),
  totalOutput: document.querySelector("#total-output"),
  dailyEnergy: document.querySelector("#daily-energy"),
  coverage: document.querySelector("#coverage"),
  currentWindSpeed: document.querySelector("#current-wind-speed"),
  updateStatus: document.querySelector("#update-status"),
  forecastCanvas: document.querySelector("#forecast-chart"),
};

const numberFormat = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 1,
});

let forecastChart;

function formatJohannesburgHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JOHANNESBURG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

function getRequiredHourlyData(hourly) {
  const { time, global_tilted_irradiance, temperature_2m, wind_speed_100m } = hourly ?? {};

  if (![time, global_tilted_irradiance, temperature_2m, wind_speed_100m]
    .every(Array.isArray)) {
    throw new Error("The weather response is missing one or more required hourly fields.");
  }

  const length = time.length;
  if (length === 0
    || global_tilted_irradiance.length !== length
    || temperature_2m.length !== length
    || wind_speed_100m.length !== length) {
    throw new Error("The weather response contains incomplete hourly data.");
  }

  return time.map((timestamp, index) => {
    const irradiance = global_tilted_irradiance[index];
    const temperature = temperature_2m[index];
    const windSpeed = wind_speed_100m[index];
    const values = [irradiance, temperature, windSpeed];

    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return { timestamp, solarKW: null, windKW: null, windSpeed };
    }

    return {
      timestamp,
      solarKW: PowerModel.solarPower(irradiance, temperature),
      windKW: PowerModel.windPower(windSpeed),
      windSpeed,
    };
  });
}

function findCurrentHourIndex(hours, now = new Date()) {
  const current = formatJohannesburgHour(now);
  const targetTimestamp = `${current.date}T${String(current.hour).padStart(2, "0")}:00`;
  const exactIndex = hours.findIndex((hour) => hour.timestamp === targetTimestamp);

  if (exactIndex !== -1) {
    return exactIndex;
  }

  return hours.findIndex((hour) => hour.timestamp >= targetTimestamp);
}

function updateMetrics(hours, currentIndex) {
  const current = hours[currentIndex];
  const currentTotal = current.solarKW + current.windKW;
  const today = formatJohannesburgHour().date;
  const todayEnergy = hours
    .filter((hour) => hour.timestamp.startsWith(today) && hour.solarKW !== null)
    .reduce((sum, hour) => sum + hour.solarKW + hour.windKW, 0);

  elements.solarOutput.textContent = numberFormat.format(current.solarKW);
  elements.windOutput.textContent = numberFormat.format(current.windKW);
  elements.totalOutput.textContent = numberFormat.format(currentTotal);
  elements.dailyEnergy.textContent = numberFormat.format(todayEnergy);
  elements.coverage.textContent = numberFormat.format(
    (todayEnergy / PowerModel.dailyDemandKWh) * 100,
  );
  elements.currentWindSpeed.textContent = numberFormat.format(current.windSpeed);
}

function renderForecast(hours, currentIndex) {
  if (typeof Chart === "undefined") {
    throw new Error("Chart.js did not load. Check your internet connection and reload.");
  }

  Chart.defaults.font.family = "Arial, sans-serif";

  const forecast = hours.slice(currentIndex, currentIndex + 24);
  if (forecast.length < 24) {
    throw new Error("The weather service did not return 24 forecast hours.");
  }

  const labels = forecast.map(({ timestamp }) => timestamp.slice(11, 16));
  const solar = forecast.map(({ solarKW }) => solarKW);
  const wind = forecast.map(({ windKW }) => windKW);
  const total = forecast.map((hour) => hour.solarKW + hour.windKW);

  if (forecastChart) {
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = solar;
    forecastChart.data.datasets[1].data = wind;
    forecastChart.data.datasets[2].data = total;
    forecastChart.update();
    return;
  }

  forecastChart = new Chart(elements.forecastCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Solar", data: solar, borderColor: "#d87924", backgroundColor: "#d87924", tension: 0.3 },
        { label: "Wind", data: wind, borderColor: "#a52a31", backgroundColor: "#a52a31", tension: 0.3 },
        { label: "Total", data: total, borderColor: "#292524", backgroundColor: "#292524", borderWidth: 3, tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#5a5350", usePointStyle: true, boxWidth: 8 },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${numberFormat.format(context.parsed.y)} kW`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgb(41 37 36 / 8%)" },
          ticks: { color: "#77716e", maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgb(41 37 36 / 8%)" },
          ticks: {
            color: "#77716e",
            callback: (value) => `${value} kW`,
          },
        },
      },
    },
  });
}

function setStatus(message, isError = false) {
  elements.updateStatus.textContent = message;
  elements.updateStatus.closest(".status-bar").classList.toggle("is-error", isError);
}

async function loadWeatherData() {
  setStatus("Updating weather data…");

  try {
    const hourly = await WeatherAPI.fetchWeather();
    const hours = getRequiredHourlyData(hourly);
    const currentIndex = findCurrentHourIndex(hours);
    if (currentIndex === -1 || hours[currentIndex].solarKW === null) {
      throw new Error("Could not find valid weather data for the current Johannesburg hour.");
    }

    updateMetrics(hours, currentIndex);
    renderForecast(hours, currentIndex);

    const updatedAt = new Intl.DateTimeFormat("en-ZA", {
      timeZone: JOHANNESBURG_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
    setStatus(`Weather updated at ${updatedAt} · Johannesburg time`);
  } catch (error) {
    console.error("Unable to update the energy dashboard:", error);
    setStatus(`Weather update failed: ${error.message}`, true);
  }
}

loadWeatherData();
window.setInterval(loadWeatherData, UPDATE_INTERVAL_MS);
