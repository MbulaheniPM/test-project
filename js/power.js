const SYSTEM = Object.freeze({
  solarCapacityKWp: 400,
  windRatedKW: 50,
  batteryCapacityKWh: 800,
  inverterEfficiency: 0.97,
  solarTemperatureCoefficient: -0.004,
  windCutInMps: 3,
  windRatedMps: 10,
  windCutOutMps: 25,
  windHubHeightM: 30,
  windMeasurementHeightM: 100,
  windShearExponent: 0.14,
  dailyDemandKWh: 1500,
});

function solarPower(irradiance, temperatureC) {
  if (!Number.isFinite(irradiance) || !Number.isFinite(temperatureC)) {
    return 0;
  }

  return SYSTEM.solarCapacityKWp
    * (irradiance / 1000)
    * (1 + SYSTEM.solarTemperatureCoefficient * (temperatureC - 25))
    * SYSTEM.inverterEfficiency;
}

function windPower(windSpeed100m) {
  if (!Number.isFinite(windSpeed100m)) {
    return 0;
  }

  const hubWind = windSpeed100m
    * (SYSTEM.windHubHeightM / SYSTEM.windMeasurementHeightM) ** SYSTEM.windShearExponent;

  if (hubWind < SYSTEM.windCutInMps || hubWind >= SYSTEM.windCutOutMps) {
    return 0;
  }

  if (hubWind < SYSTEM.windRatedMps) {
    return SYSTEM.windRatedKW
      * ((hubWind ** 3 - SYSTEM.windCutInMps ** 3)
        / (SYSTEM.windRatedMps ** 3 - SYSTEM.windCutInMps ** 3));
  }

  return SYSTEM.windRatedKW;
}

window.PowerModel = Object.freeze({
  dailyDemandKWh: SYSTEM.dailyDemandKWh,
  solarPower,
  windPower,
});
