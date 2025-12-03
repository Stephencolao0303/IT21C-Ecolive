// =====================
// OOP: Sensor classes (Encapsulation + Inheritance)
class Sensor {
  #name; #value; // private properties
  constructor(name, value, desc = "", city = "", lat = null, lon = null) {
    this.#name = name;
    this.#value = value;
    this.description = desc;
    this.city = city;
    this.lat = lat;
    this.lon = lon;
  }
  getName() { return this.#name; }
  getValue() { return this.#value; }
  setValue(v) { this.#value = v; }
  toJSON() { // custom serialize for storage
    return {
      name: this.getName(),
      value: this.getValue(),
      description: this.description,
      city: this.city,
      lat: this.lat,
      lon: this.lon
    };
  }
  display() { return `${this.getName()}: ${this.getValue()}`; }
}

// TemperatureSensor inherits Sensor — demonstrates Inheritance
class TemperatureSensor extends Sensor {
  constructor(name, value, desc = "", city = "", lat = null, lon = null, unit = "°C") {
    super(name, value, desc, city, lat, lon);
    this.unit = unit;
  }
  display() { return `${this.getName()}: ${this.getValue()} ${this.unit}`; }
  toJSON() {
    const base = super.toJSON();
    base.unit = this.unit;
    base.type = "temperature";
    return base;
  }
}

// =====================
// Storage helpers (localStorage)
const STORAGE_KEY = "eco_sensors_v1";

function readRawSensors() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

// Reconstruct objects: convert stored plain objects back to Sensor/TemperatureSensor instances
function getAllSensors() {
  const raw = readRawSensors();
  return raw.map(obj => {
    if (obj.type === "temperature" || (obj.name && obj.name.toLowerCase().includes("temp"))) {
      return new TemperatureSensor(obj.name, obj.value, obj.description || "", obj.city || "", obj.lat || null, obj.lon || null, obj.unit || "°C");
    } else {
      return new Sensor(obj.name, obj.value, obj.description || "", obj.city || "", obj.lat || null, obj.lon || null);
    }
  });
}

function saveAllSensors(instances) {
  const plain = instances.map(s => s.toJSON());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
}

// =====================
// Manage Sensors UI (Add / Update / Delete)
// Elements
const dataForm = document.getElementById("dataForm");
const dataList = document.getElementById("dataList");
const autoCheckbox = document.getElementById("autoValue");
const cityInputField = document.getElementById("cityInput");

// Utility: generate a demo random value
function randomValueForDemo() {
  return +(Math.random() * 100).toFixed(1); // 0.0 - 100.0
}

// Render Manage Sensors (all sensors)
function renderManageList() {
  const sensors = getAllSensors();
  dataList.innerHTML = "";
  sensors.forEach((s, idx) => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.innerHTML = `<strong>${s.getName()}</strong><br><small>${s.description || ""}</small><br><small>City: ${s.city || "-"}</small>`;
    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const val = document.createElement("span");
    val.textContent = s.getValue();
    right.appendChild(val);

    // edit button -> populate form
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => {
      document.getElementById("sensorName").value = s.getName();
      document.getElementById("sensorDesc").value = s.description || "";
      document.getElementById("sensorCity").value = s.city || "";
      document.getElementById("sensorValue").value = s.getValue();
      document.getElementById("autoValue").checked = false;
    });
    right.appendChild(editBtn);

    // delete button
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      sensors.splice(idx, 1);
      saveAllSensors(sensors);
      renderManageList();
      // if current city view matches, refresh city rendering
      if (currentCity) renderCityView(currentCity);
    });
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);
    dataList.appendChild(li);
  });
}

// Handle add/update form submit
dataForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("sensorName").value.trim();
  const desc = document.getElementById("sensorDesc").value.trim();
  const city = document.getElementById("sensorCity").value.trim();
  const manualValueRaw = document.getElementById("sensorValue").value;
  const auto = document.getElementById("autoValue").checked;

  if (!name || !city) {
    alert("Sensor Name and City are required.");
    return;
  }

  let value;
  if (auto) {
    // Option A: auto-generate a demo value
    value = randomValueForDemo();
  } else if (manualValueRaw !== "") {
    // Option B: user provided manual value
    value = parseFloat(manualValueRaw);
    if (Number.isNaN(value)) { alert("Invalid manual value"); return; }
  } else {
    // neither manual nor auto -> ask user to either provide a value or tick auto
    if (!confirm("No value entered. Do you want to auto-generate a demo value?")) {
      return;
    }
    value = randomValueForDemo();
  }

  // Try to find coordinates for city (use OpenWeather current weather to get coords)
  const coords = await resolveCityCoords(city);

  // Build sensor instance: if name suggests temperature or includes 'temp', create TemperatureSensor
  const allSensors = getAllSensors();
  const index = allSensors.findIndex(s => s.getName().toLowerCase() === name.toLowerCase());

  const lat = coords ? coords.lat : null;
  const lon = coords ? coords.lon : null;

  if (index >= 0) {
    // update existing
    allSensors[index].setValue(value);
    allSensors[index].description = desc;
    allSensors[index].city = city;
    allSensors[index].lat = lat;
    allSensors[index].lon = lon;
  } else {
    const instance = (name.toLowerCase().includes("temp") || name.toLowerCase().includes("temperature"))
      ? new TemperatureSensor(name, value, desc, city, lat, lon)
      : new Sensor(name, value, desc, city, lat, lon);
    allSensors.push(instance);
  }

  saveAllSensors(allSensors);
  renderManageList();

  // If the currently viewed city matches this sensor's city, refresh the city view
  if (currentCity && currentCity.toLowerCase() === city.toLowerCase()) {
    renderCityView(currentCity);
  }

  dataForm.reset();
});

// initialize manage list
renderManageList();

// =====================
// Chart.js setup (shows sensors for the current city only)
const ctx = document.getElementById('envChart').getContext('2d');
const envChart = new Chart(ctx, {
  type: 'bar',
  data: { labels: [], datasets: [{ label: 'Sensor Values', data: [], backgroundColor: [] }] },
  options: { responsive: true, maintainAspectRatio: false }
});

function updateChartForSensors(sensorArray) {
  envChart.data.labels = sensorArray.map(s => s.getName());
  envChart.data.datasets[0].data = sensorArray.map(s => s.getValue());
  envChart.data.datasets[0].backgroundColor = sensorArray.map(() => '#2e8b57');
  envChart.update();
}

// =====================
// Leaflet Map setup
const map = L.map('map').setView([8.2280, 125.2433], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
let cityMarkersLayer = L.layerGroup().addTo(map);

// Show only sensors for selected city on the map
function updateMapForSensors(sensorArray, focusLat = null, focusLon = null) {
  cityMarkersLayer.clearLayers();
  if (!sensorArray || sensorArray.length === 0) {
    if (focusLat && focusLon) map.setView([focusLat, focusLon], 8);
    return;
  }

  sensorArray.forEach(s => {
    const lat = s.lat ?? focusLat;
    const lon = s.lon ?? focusLon;
    if (lat != null && lon != null) {
      const m = L.marker([lat, lon]).addTo(cityMarkersLayer);
      m.bindPopup(`<strong>${s.getName()}</strong><br>${s.description || ""}<br>Value: ${s.getValue()}`);
    }
  });

  // center map on first sensor or provided focus coords
  const center = (sensorArray[0].lat && sensorArray[0].lon) ? [sensorArray[0].lat, sensorArray[0].lon] : (focusLat && focusLon ? [focusLat, focusLon] : null);
  if (center) map.setView(center, 10);
}

// =====================
// Weather integration: search city and render city view
const OPENWEATHER_KEY = "96bc625a9a03c36253c2ea64cba0f9e3"; // <<< REPLACE THIS

async function fetchWeatherForCity(city) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) { console.error(e); return null; }
}

// Resolve coords helper (returns {lat,lon} or null)
async function resolveCityCoords(city) {
  const data = await fetchWeatherForCity(city);
  if (data && data.coord) return { lat: data.coord.lat, lon: data.coord.lon, raw: data };
  return null;
}

// Current city being viewed (string)
let currentCity = null;

// Render only sensors that belong to a city (city search triggers this)
async function renderCityView(city) {
  if (!city) return;
  currentCity = city;

  // Show weather
  const weatherBox = document.getElementById("weatherResult");
  weatherBox.innerHTML = "Loading weather...";

  const weatherData = await fetchWeatherForCity(city);
  if (!weatherData || !weatherData.main) {
    weatherBox.textContent = "City not found / weather unavailable.";
    // Show any sensors that match city name (if stored without coords)
    const allSensors = getAllSensors();
    const filtered = allSensors.filter(s => s.city && s.city.toLowerCase() === city.toLowerCase());
    updateChartForSensors(filtered);
    updateMapForSensors(filtered);
    return;
  }

  // Show weather info
  weatherBox.innerHTML = `
    <div><strong>${weatherData.name}, ${weatherData.sys.country}</strong></div>
    <div>Temp: ${weatherData.main.temp} °C</div>
    <div>Humidity: ${weatherData.main.humidity}%</div>
    <div>Weather: ${weatherData.weather[0].main}</div>
  `;

  // Create/update the default city temperature sensor (CityName Temp)
  const allSensors = getAllSensors();
  const cityTempName = `${weatherData.name} Temp`;
  const cityTempVal = +weatherData.main.temp;
  const coords = { lat: weatherData.coord.lat, lon: weatherData.coord.lon };

  const idx = allSensors.findIndex(s => s.getName().toLowerCase() === cityTempName.toLowerCase());
  if (idx >= 0) {
    allSensors[idx].setValue(cityTempVal);
    allSensors[idx].lat = coords.lat; allSensors[idx].lon = coords.lon;
    allSensors[idx].city = weatherData.name;
  } else {
    // add TemperatureSensor for the city
    allSensors.push(new TemperatureSensor(cityTempName, cityTempVal, "Auto city temperature", weatherData.name, coords.lat, coords.lon));
  }

  saveAllSensors(allSensors);
  renderManageList();

  // Filter sensors belonging to this city (case-insensitive)
  const filteredSensors = allSensors.filter(s => s.city && s.city.toLowerCase() === weatherData.name.toLowerCase());

  // Update chart & map to show only filteredSensors
  updateChartForSensors(filteredSensors);
  updateMapForSensors(filteredSensors, coords.lat, coords.lon);
}

// Hook search button
document.getElementById("fetchWeather").addEventListener("click", async () => {
  const city = document.getElementById("cityInput").value.trim();
  if (!city) {
    alert("Enter a city to search");
    return;
  }
  await renderCityView(city);
});

// If page loads and there is a previously viewed city stored, optionally restore — not required now

// Initialize: set empty array if nothing
if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, "[]");

// Final initial render of manage list
renderManageList();

// =====================
// Theme Toggle Logic
const themeToggleBtn = document.getElementById("themeToggle");
const body = document.body;
const THEME_KEY = "ecolive_theme";

// Load saved theme
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  body.classList.add("dark-mode");
  if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

// Toggle theme on click
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    body.classList.toggle("dark-mode");
    const isDark = body.classList.contains("dark-mode");

    // Update icon
    themeToggleBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';

    // Save preference
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

    // Update Chart.js colors if needed (optional, but good for visibility)
    if (window.envChart) {
      const newColor = isDark ? '#4ade80' : '#2e8b57'; // Lighter green for dark mode
      envChart.data.datasets[0].backgroundColor = envChart.data.datasets[0].data.map(() => newColor);
      envChart.update();
    }
  });
}
