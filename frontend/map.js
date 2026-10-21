const map = L.map("map").setView([shared.loc.lat, shared.loc.lon], 8);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

const pin = L.marker([shared.loc.lat, shared.loc.lon]).addTo(map);
const layers = {}, meta = {}, data = {};
const noahProducts = {
  "1hr": {
    url: "https://webgis-static.up.edu.ph/api/contours/1hr_latest_rainfall_contour.png",
    bounds: [[3.85, 115.35], [21.55, 128.25]],
    label: "Latest 1-hour rainfall contour"
  },
  "3hr": {
    url: "https://webgis-static.up.edu.ph/api/contours/3hr_latest_rainfall_contour.png",
    bounds: [[3.85, 115.35], [21.55, 128.25]],
    label: "Latest 3-hour rainfall contour"
  },
  "6hr": {
    url: "https://webgis-static.up.edu.ph/api/contours/6hr_latest_rainfall_contour.png",
    bounds: [[3.85, 115.35], [21.55, 128.25]],
    label: "Latest 6-hour rainfall contour"
  },
  "12hr": {
    url: "https://webgis-static.up.edu.ph/api/contours/12hr_latest_rainfall_contour.png",
    bounds: [[3.85, 115.35], [21.55, 128.25]],
    label: "Latest 12-hour rainfall contour"
  },
  "24hr": {
    url: "https://webgis-static.up.edu.ph/api/contours/24hr_latest_rainfall_contour.png",
    bounds: [[3.85, 115.35], [21.55, 128.25]],
    label: "Latest 24-hour rainfall contour"
  },
  forecast: {
    url: "https://webgis-static.up.edu.ph/api/rainfall/rainmap_gtif_day1.png",
    bounds: [[5.205, 116.855], [19.402, 127.055]],
    label: "Day 1 rainfall forecast"
  }
};

let selectedPoint = null;
let noahOverlay = null;
let typhoonMarker = null;
let activeTyphoon = null;

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeom(pt, geometry) {
  if (!geometry) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates]
    : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.some(polygon => inRing(pt, polygon[0]) && !polygon.slice(1).some(hole => inRing(pt, hole)));
}

const km = (a, b, c, d) => {
  const radians = Math.PI / 180;
  const x = (c - a) * radians;
  const y = (d - b) * radians * Math.cos((a + c) / 2 * radians);
  return 6371 * Math.hypot(x, y);
};

function check(lat, lon) {
  selectedPoint = { lat, lon };
  pin.setLatLng([lat, lon]);
  $("#spot-coordinates").textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const results = $("#spot-results");
  results.replaceChildren();

  for (const slug in data) {
    if (!layers[slug] || !map.hasLayer(layers[slug])) continue;
    const layerMeta = meta[slug];
    let result;

    if (slug === "earthquake") {
      const nearby = data[slug].features.filter(feature =>
        km(lat, lon, feature.geometry.coordinates[1], feature.geometry.coordinates[0]) < 150
      );
      const largest = nearby.reduce((max, feature) => Math.max(max, feature.properties.mag || 0), 0);
      result = nearby.length
        ? `${nearby.length} earthquake(s) within 150 km this week, largest M${largest.toFixed(1)}`
        : "No recent earthquakes within 150 km";
    } else {
      const hits = data[slug].features.filter(feature => inGeom([lon, lat], feature.geometry));
      result = hits.length
        ? `Inside ${layerMeta.label.toLowerCase()} zone (${hits.map(feature =>
          feature.properties.level || feature.properties.name || layerMeta.label
        ).join(", ")})`
        : `Not inside a mapped ${layerMeta.label.toLowerCase()} zone`;
    }

    const item = document.createElement("li");
    item.className = result.startsWith("No recent") || result.startsWith("Not inside") ? "muted" : "";
    if (item.className !== "muted") {
      const swatch = document.createElement("span");
      swatch.className = "sw";
      swatch.style.backgroundColor = layerMeta.color;
      item.append(swatch);
    }
    item.append(document.createTextNode(result));
    results.append(item);
  }

  if (!results.children.length) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "Turn on a layer to check this location.";
    results.append(item);
  }
}

map.on("click", event => check(event.latlng.lat, event.latlng.lng));

function setNoahStatus(message, isError = false) {
  const status = $("#noah-note");
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function updateNoahOverlay() {
  const enabled = $("#noah-enabled").checked;
  const productKey = $("#noah-period").value;
  const product = noahProducts[productKey];

  if (noahOverlay) {
    map.removeLayer(noahOverlay);
    noahOverlay = null;
  }
  if (!enabled) {
    setNoahStatus("Rainfall overlay is turned off.");
    return;
  }
  if (!product) {
    setNoahStatus("The selected rainfall product is unavailable.", true);
    return;
  }

  setNoahStatus(`Loading ${product.label} from UP NOAH…`);
  const overlay = L.imageOverlay(product.url, product.bounds, { opacity: 0.78, crossOrigin: true });
  noahOverlay = overlay;
  overlay.on("load", () => {
    if (noahOverlay === overlay) setNoahStatus(`${product.label} · Source: UP NOAH`);
  });
  overlay.on("error", () => {
    if (noahOverlay === overlay) {
      setNoahStatus("UP NOAH rainfall imagery could not be loaded. Try again later or open the official updates.", true);
    }
  });
  overlay.addTo(map);
}

$("#noah-period").addEventListener("change", updateNoahOverlay);
$("#noah-enabled").addEventListener("change", updateNoahOverlay);
updateNoahOverlay();
bindUnits();

function appendTyphoonDetail(label, value) {
  if (!value) return;
  const line = document.createElement("p");
  const labelNode = document.createElement("strong");
  labelNode.textContent = `${label}: `;
  line.append(labelNode, document.createTextNode(value));
  $("#typhoon-details").append(line);
}

async function loadTyphoon() {
  const button = $("#typhoon-refresh");
  button.disabled = true;
  activeTyphoon = null;
  if (typhoonMarker) {
    map.removeLayer(typhoonMarker);
    typhoonMarker = null;
  }
  $("#typhoon-focus").disabled = true;
  $("#typhoon-badge").textContent = "Checking";
  $("#typhoon-badge").classList.remove("is-active");
  $("#typhoon-details").replaceChildren();
  $("#typhoon-track-link").hidden = true;
  $("#typhoon-note").classList.remove("is-error");
  $("#typhoon-note").textContent = "Checking the latest PAGASA bulletin…";

  try {
    const report = await api("/api/typhoon");
    $("#typhoon-details").replaceChildren();
    $("#typhoon-track-link").hidden = true;

    if (!report.active) {
      $("#typhoon-badge").textContent = "No active storm";
      $("#typhoon-badge").classList.remove("is-active");
      $("#typhoon-details").textContent = report.message;
      $("#typhoon-note").textContent = "PAGASA is the official source for Philippine cyclone warnings.";
      $("#typhoon-track-link").href = report.bulletin_url;
      return;
    }

    activeTyphoon = report;
    const popup = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = report.name;
    const coordinates = document.createElement("p");
    coordinates.textContent = `${report.latitude.toFixed(2)}°${report.latitude < 0 ? "S" : "N"}, ${report.longitude.toFixed(2)}°${report.longitude < 0 ? "W" : "E"}`;
    popup.append(name, coordinates);

    typhoonMarker = L.marker([report.latitude, report.longitude], {
      icon: L.divIcon({
        className: "typhoon-marker-container",
        html: '<span class="typhoon-map-marker" aria-hidden="true"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      }),
      title: report.name,
      alt: `Current PAGASA position: ${report.name}`
    }).addTo(map).bindPopup(popup);

    $("#typhoon-badge").textContent = "Active";
    $("#typhoon-badge").classList.add("is-active");
    appendTyphoonDetail("Storm", report.name);
    appendTyphoonDetail("Bulletin", report.issued_at);
    appendTyphoonDetail("Position", report.center);
    appendTyphoonDetail("Movement", report.movement);
    appendTyphoonDetail("Strength", report.strength);
    $("#typhoon-focus").disabled = false;

    $("#typhoon-track-link").href = report.track_image || report.bulletin_url;
    if (report.track_image) {
      $("#typhoon-track-image").src = report.track_image;
      $("#typhoon-track-link").hidden = false;
      $("#typhoon-track-image").onerror = () => {
        $("#typhoon-track-link").hidden = true;
        $("#typhoon-note").textContent = "Current storm position is mapped; the official track image could not be loaded.";
      };
    }
    $("#typhoon-note").textContent = `Current position from PAGASA · ${report.issued_at || "See official bulletin for issue time."}`;
  } catch (error) {
    $("#typhoon-badge").textContent = "Unavailable";
    $("#typhoon-badge").classList.remove("is-active");
    $("#typhoon-details").textContent = `Could not load the PAGASA bulletin: ${error.message}`;
    $("#typhoon-note").classList.add("is-error");
    $("#typhoon-note").textContent = "Tracker data is unavailable. Open the official PAGASA bulletin for current warnings.";
    $("#typhoon-track-link").href = "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin";
    console.error("Failed to load PAGASA typhoon bulletin", error);
  } finally {
    button.disabled = false;
  }
}

$("#typhoon-refresh").addEventListener("click", loadTyphoon);
$("#typhoon-focus").addEventListener("click", () => {
  if (!activeTyphoon) return;
  map.setView([activeTyphoon.latitude, activeTyphoon.longitude], 6);
  typhoonMarker.openPopup();
});
loadTyphoon();

async function loadLayer(layerMeta, enabled) {
  if (!enabled) {
    if (layers[layerMeta.slug]) map.removeLayer(layers[layerMeta.slug]);
    if (selectedPoint) check(selectedPoint.lat, selectedPoint.lon);
    return;
  }
  if (layers[layerMeta.slug]) {
    layers[layerMeta.slug].addTo(map);
    if (selectedPoint) check(selectedPoint.lat, selectedPoint.lon);
    return;
  }

  const note = document.getElementById(`note-${layerMeta.slug}`);
  const checkbox = document.getElementById(`cb-${layerMeta.slug}`);
  try {
    const geoJson = await api(layerMeta.slug === "earthquake"
      ? "/api/earthquakes"
      : `/api/hazards/${encodeURIComponent(layerMeta.slug)}`);
    data[layerMeta.slug] = geoJson;
    layers[layerMeta.slug] = L.geoJSON(geoJson, {
      style: { color: layerMeta.color, weight: 2, fillOpacity: .3 },
      pointToLayer: (feature, point) => L.circleMarker(point, {
        radius: 3 + (feature.properties.mag || 1) * 2,
        color: layerMeta.color,
        fillOpacity: .6
      }),
      onEachFeature: (feature, featureLayer) =>
        featureLayer.bindPopup(feature.properties.title || feature.properties.name || layerMeta.label)
    }).addTo(map);
    note.textContent = geoJson.features.length ? `${geoJson.features.length} features` : "No data yet";
    note.classList.remove("hazard-layer-error");
    if (selectedPoint) check(selectedPoint.lat, selectedPoint.lon);
  } catch (error) {
    note.textContent = `Could not load: ${error.message}`;
    note.classList.add("hazard-layer-error");
    checkbox.checked = false;
    console.error(`Failed to load ${layerMeta.slug} map layer`, error);
  }
}

function goTo(location) {
  map.setView([location.lat, location.lon], 9);
  check(location.lat, location.lon);
}

bindSearch(goTo);

function appendHazardLayer(layerMeta) {
  const wrapper = document.createElement("div");
  wrapper.className = "hazard-layer";

  const label = document.createElement("label");
  label.className = "hazard-layer-toggle";
  label.htmlFor = `cb-${layerMeta.slug}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `cb-${layerMeta.slug}`;
  checkbox.addEventListener("change", () => loadLayer(layerMeta, checkbox.checked));

  const swatch = document.createElement("span");
  swatch.className = "sw";
  swatch.style.backgroundColor = layerMeta.color;

  const title = document.createElement("strong");
  title.textContent = layerMeta.label;
  label.append(checkbox, swatch, title);

  const detail = document.createElement("p");
  detail.className = "hazard-layer-detail";
  detail.append(document.createTextNode(`${layerMeta.description} Source: `));

  if (layerMeta.source_url) {
    const source = document.createElement("a");
    source.href = layerMeta.source_url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = layerMeta.source_name || "Data source";
    detail.append(source, document.createTextNode(". "));
  } else {
    detail.append(document.createTextNode(`${layerMeta.source_name || "Unknown source"}. `));
  }

  const note = document.createElement("span");
  note.id = `note-${layerMeta.slug}`;
  detail.append(note);

  if (layerMeta.slug === "flood") {
    const caution = document.createElement("span");
    caution.className = "hazard-layer-note";
    caution.textContent = " Sample polygon only; not an official UP NOAH hazard layer.";
    detail.append(caution);
  }

  wrapper.append(label, detail);
  $("#layers").append(wrapper);
}

(async () => {
  try {
    const availableLayers = await api("/api/hazard-layers");
    $("#layer-count").textContent = `${availableLayers.length} available`;
    $("#layers").replaceChildren();
    availableLayers.forEach(layerMeta => {
      meta[layerMeta.slug] = layerMeta;
      appendHazardLayer(layerMeta);
    });

    const earthquakes = document.getElementById("cb-earthquake");
    if (earthquakes) {
      earthquakes.checked = true;
      loadLayer(meta.earthquake, true);
    }
    check(shared.loc.lat, shared.loc.lon);
  } catch (error) {
    $("#layer-count").textContent = "Unavailable";
    $("#layers").textContent = `Could not load hazard layers: ${error.message}`;
    console.error("Failed to load hazard layer list", error);
  }
})();
