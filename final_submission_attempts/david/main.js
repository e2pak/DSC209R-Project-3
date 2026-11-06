const INDICATOR_PREFIX = "CO2 emissions, Metric ton";
const YEAR_MIN = 1995;
const YEAR_MAX = 2018;
const YEARS = d3.range(YEAR_MIN, YEAR_MAX + 1).map(String);

// IMF country names do not match Natural Earth. iso is the numeric id
// used by world-atlas. lon/lat is only used when that country is missing
// from the 110m map.
const PLACES = [
  { csv: "Argentina", iso: "32", label: "Argentina" },
  { csv: "Australia", iso: "36", label: "Australia" },
  { csv: "Austria", iso: "40", label: "Austria" },
  { csv: "Belgium", iso: "56", label: "Belgium" },
  { csv: "Brazil", iso: "76", label: "Brazil" },
  { csv: "Brunei Darussalam", iso: "96", label: "Brunei" },
  { csv: "Bulgaria", iso: "100", label: "Bulgaria" },
  { csv: "Cambodia", iso: "116", label: "Cambodia" },
  { csv: "Canada", iso: "124", label: "Canada" },
  { csv: "Chile", iso: "152", label: "Chile" },
  { csv: "China, People's Republic of", iso: "156", label: "China" },
  { csv: "Colombia", iso: "170", label: "Colombia" },
  { csv: "Costa Rica", iso: "188", label: "Costa Rica" },
  { csv: "Croatia, Republic of", iso: "191", label: "Croatia" },
  { csv: "Cyprus", iso: "196", label: "Cyprus" },
  { csv: "Czech Republic", iso: "203", label: "Czech Republic" },
  { csv: "Denmark", iso: "208", label: "Denmark" },
  { csv: "Estonia, Republic of", iso: "233", label: "Estonia" },
  { csv: "Finland", iso: "246", label: "Finland" },
  { csv: "France", iso: "250", label: "France" },
  { csv: "Germany", iso: "276", label: "Germany" },
  { csv: "Greece", iso: "300", label: "Greece" },
  {
    csv: "Hong Kong Special Administrative Region, People's Republic of China",
    iso: "344",
    label: "Hong Kong",
    fallback: [114.17, 22.32],
  },
  { csv: "Hungary", iso: "348", label: "Hungary" },
  { csv: "Iceland", iso: "352", label: "Iceland" },
  { csv: "India", iso: "356", label: "India" },
  { csv: "Indonesia", iso: "360", label: "Indonesia" },
  { csv: "Ireland", iso: "372", label: "Ireland" },
  { csv: "Israel", iso: "376", label: "Israel" },
  { csv: "Italy", iso: "380", label: "Italy" },
  { csv: "Japan", iso: "392", label: "Japan" },
  { csv: "Kazakhstan, Republic of", iso: "398", label: "Kazakhstan" },
  { csv: "Korea, Republic of", iso: "410", label: "South Korea" },
  { csv: "Lao People's Democratic Republic", iso: "418", label: "Laos" },
  { csv: "Latvia, Republic of", iso: "428", label: "Latvia" },
  { csv: "Lithuania, Republic of", iso: "440", label: "Lithuania" },
  { csv: "Luxembourg", iso: "442", label: "Luxembourg" },
  { csv: "Malaysia", iso: "458", label: "Malaysia" },
  { csv: "Malta", iso: "470", label: "Malta", fallback: [14.51, 35.9] },
  { csv: "Mexico", iso: "484", label: "Mexico" },
  { csv: "Morocco", iso: "504", label: "Morocco" },
  { csv: "Myanmar", iso: "104", label: "Myanmar" },
  { csv: "Netherlands, The", iso: "528", label: "Netherlands" },
  { csv: "New Zealand", iso: "554", label: "New Zealand" },
  { csv: "Norway", iso: "578", label: "Norway" },
  { csv: "Peru", iso: "604", label: "Peru" },
  { csv: "Philippines", iso: "608", label: "Philippines" },
  { csv: "Poland, Republic of", iso: "616", label: "Poland" },
  { csv: "Portugal", iso: "620", label: "Portugal" },
  { csv: "Romania", iso: "642", label: "Romania" },
  { csv: "Russian Federation", iso: "643", label: "Russia" },
  { csv: "Saudi Arabia", iso: "682", label: "Saudi Arabia" },
  {
    csv: "Singapore",
    iso: "702",
    label: "Singapore",
    fallback: [103.82, 1.35],
  },
  { csv: "Slovak Republic", iso: "703", label: "Slovakia" },
  { csv: "Slovenia, Republic of", iso: "705", label: "Slovenia" },
  { csv: "South Africa", iso: "710", label: "South Africa" },
  { csv: "Spain", iso: "724", label: "Spain" },
  { csv: "Sweden", iso: "752", label: "Sweden" },
  { csv: "Switzerland", iso: "756", label: "Switzerland" },
  { csv: "Taiwan Province of China", iso: "158", label: "Taiwan" },
  { csv: "Thailand", iso: "764", label: "Thailand" },
  { csv: "Tunisia", iso: "788", label: "Tunisia" },
  { csv: "Türkiye, Republic of", iso: "792", label: "Turkey" },
  { csv: "United Kingdom", iso: "826", label: "United Kingdom" },
  { csv: "United States", iso: "840", label: "United States" },
  { csv: "Vietnam", iso: "704", label: "Vietnam" },
];

const totalFormat = d3.format(",.3f");
const avgFormat = d3.format(",.3f");

const mapNode = document.getElementById("map");
const statusNode = document.getElementById("status");
const legendNode = document.getElementById("legend");
const slider = document.getElementById("year");
const yearLabel = document.getElementById("year-label");
const playButton = document.getElementById("play");
const card = document.getElementById("hover-card");
const industrySelect = document.getElementById("industries");
const dataSelect = document.getElementById("per-capita");

let flag = true;
let file = "../../CO2_emissions.csv";
let rawRows = null;
let rawWorld = null;
let places = [];
let maxTotal = 1;
let width = 0;
let height = 0;
let projection = d3.geoMercator();
let path = d3.geoPath(projection);
let landFeature = null;
let svg = null;
let countrySel = null;
let labelSel = null;
let hovered = null;
let playTimer = null;
let currentYear = 2018;
let currentIndustry = "";
const countryFill = d3.interpolateRgbBasis([
  "#b7e4a8",
  "#3fa34d",
  "#f0b429",
  "#e23b3b",
]);

const COLORS = ["#3fa34d", "#f0b429", "#e23b3b"];
const quantize = d3.scaleQuantize().range(COLORS);

// function colorOf(value) {
//   const t = Math.sqrt(Math.max(0, value) / maxTotal);
//   return countryFill(Math.max(0, Math.min(1, t)));
// }

function colorOf(value) {
  return quantize.domain([0, maxTotal])(Math.max(0, value));
}

function shortIndustry(name) {
  const head = name.split(";")[0].trim();
  return head.length > 18 ? head.slice(0, 16) + "…" : head;
}

// Centroid of the largest land polygon, so overseas territories do not
// pull France, the United States, or similar countries off their mainland.
function representativeLonLat(feature) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (geometry.type !== "MultiPolygon") return d3.geoCentroid(feature);
  let best = null;
  let bestArea = -1;
  for (const coordinates of geometry.coordinates) {
    const polygon = { type: "Polygon", coordinates };
    const area = Math.abs(d3.geoArea(polygon));
    if (area > bestArea) {
      bestArea = area;
      best = d3.geoCentroid(polygon);
    }
  }
  return best;
}

function featureIndex(collection) {
  const index = new Map();
  for (const feature of collection.features) {
    const id = String(Number(feature.id));
    index.set(id, feature);
  }
  return index;
}

function preparePlaces(rows, world) {
  const emissions = rows.filter(
    (row) => row.INDICATOR && row.INDICATOR.startsWith(INDICATOR_PREFIX),
  );
  const byCountry = d3.group(emissions, (row) => row.COUNTRY);
  const countries = topojson.feature(world, world.objects.countries);
  const index = featureIndex(countries);

  const located = [];
  for (const meta of PLACES) {
    const countryRows = byCountry.get(meta.csv);
    if (!countryRows || !countryRows.length) {
      console.warn("No emissions rows for", meta.csv);
      continue;
    }
    const feature = index.get(String(Number(meta.iso)));
    const lonLat = feature ? representativeLonLat(feature) : meta.fallback;
    if (!lonLat || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) {
      console.warn("No map location for", meta.csv);
      continue;
    }
    const byYear = {};
    for (const year of YEARS) {
      const industries = countryRows
        .map((row) => ({ name: row.INDUSTRY, value: +row[year] || 0 }))
        .sort((a, b) => b.value - a.value);
      const total = d3.sum(industries, (d) => d.value);
      const avg = industries.length ? total / industries.length : 0;
      byYear[year] = { total, avg, top: industries.slice(0, 6) };
    }
    located.push({ ...meta, lon: lonLat[0], lat: lonLat[1], byYear });
  }

  const byIso = new Map(
    located.map((place) => [String(Number(place.iso)), place]),
  );
  landFeature = {
    type: "FeatureCollection",
    features: countries.features
      .filter((feature) => String(feature.id) !== "010")
      .map((feature) => ({
        ...feature,
        place: byIso.get(String(Number(feature.id))) || null,
      })),
  };
  const missing = located.filter(
    (place) => !landFeature.features.some((feature) => feature.place === place),
  );
  if (missing.length) {
    console.warn(
      "No country polygon for",
      missing.map((place) => place.label).join(", "),
    );
  }
  return located;
}

function drawIndustryChart(top) {
  const svgWidth = 250;
  const svgHeight = 168;
  const margin = { top: 8, right: 4, bottom: 74, left: 34 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;
  const chart = d3
    .select("#industry-chart")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
  chart.selectAll("*").remove();
  if (currentIndustry !== "") {
    d3.select("#chartArea").style("display", "none");
    return;
  } else d3.select("#chartArea").style("display", null);
  const root = chart
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3
    .scaleBand()
    .domain(top.map((d) => d.name))
    .range([0, innerWidth])
    .padding(0.28);
  const yMax = d3.max(top, (d) => d.value) || 1;
  const y = d3
    .scaleLinear()
    .domain([0, yMax * 1.08])
    .range([innerHeight, 0]);

  root
    .append("g")
    .call(
      d3.axisLeft(y).ticks(4).tickSize(-innerWidth).tickFormat(d3.format("~s")),
    )
    .call((g) => g.select(".domain").remove())
    .call((g) =>
      g
        .selectAll(".tick line")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-dasharray", "2 2"),
    )
    .call((g) => g.selectAll(".tick text").attr("x", -4));

  root
    .selectAll("rect")
    .data(top)
    .join("rect")
    .attr("x", (d) => x(d.name))
    .attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", (d) => innerHeight - y(d.value))
    .attr("fill", "#4f7cff")
    .append("title")
    .text((d) => `${d.name}: ${totalFormat(d.value)}`);

  root
    .append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat(shortIndustry))
    .call((g) => g.select(".domain").attr("stroke", "#cbd5e1"))
    .call((g) =>
      g
        .selectAll(".tick text")
        .attr("transform", "rotate(-55)")
        .style("text-anchor", "end")
        .attr("dx", "-0.3em")
        .attr("dy", "0.2em"),
    );
}

function moveCard(event) {
  const pad = 14;
  const rect = card.getBoundingClientRect();
  let x = event.clientX + 16;
  let y = event.clientY + 16;
  if (x + rect.width > window.innerWidth - 8)
    x = event.clientX - rect.width - 16;
  if (y + rect.height > window.innerHeight - 8)
    y = event.clientY - rect.height - 16;
  card.style.left = `${Math.max(8, x)}px`;
  card.style.top = `${Math.max(8, y)}px`;
}

function getSelectedValue(place, yearKey) {
  if (currentIndustry === "") return place.byYear[yearKey].total;
  return place.byYear[yearKey].total || 0;
}

function showCard(event, place) {
  const stats = place.byYear[String(currentYear)];
  const globalTotal = d3.sum(places, (p) => getSelectedValue(p, String(currentYear)));
  const unit = document.querySelector(".avg-panel .unit");
  const value = document.querySelector(".avg-panel .value");
  const val = getSelectedValue(place, String(currentYear));
  const percentShare = globalTotal > 0 ? (val / globalTotal) * 100 : 0;
  const hide = currentIndustry !== "";

  unit.style.display = hide ? "none" : "";
  value.style.display = hide ? "none" : "";

  document.getElementById("card-total").replaceChildren();
  document.getElementById("card-name").textContent =
    `${place.label} · ${currentYear}`;

  document.getElementById("card-total").insertAdjacentHTML(
    "afterbegin",
    `
  	<p class="unit">Total CO2 emissions, Metric ton of CO₂</p>
	<p class="value">${totalFormat(stats.total)}</p>
  	`,
  );
  document.getElementById("card-avg").textContent = avgFormat(stats.avg);
  document.getElementById("card-all-pct").textContent = `${percentShare.toFixed(2)}%`;
  drawIndustryChart(stats.top);
  card.classList.add("visible");
  card.setAttribute("aria-hidden", "false");
  moveCard(event);
}

function hideCard() {
  card.classList.remove("visible");
  card.setAttribute("aria-hidden", "true");
}

function refreshLabels() {
  const labeled = [];
  const nodes = labelSel.nodes();
  const ranked = nodes
    .map((node) => {
      const place = node.__data__;
      const value = place.byYear[String(currentYear)].total;
      const [px, py] = projection([place.lon, place.lat]);
      return { node, place, value, px, py };
    })
    .sort((a, b) => b.value - a.value);
  const named = new Set(ranked.slice(0, 11).map((item) => item.place));
  for (const item of ranked) {
    const text = d3.select(item.node);
    const forced = hovered === item.place;
    const onMap =
      item.px >= 24 &&
      item.px <= width - 24 &&
      item.py >= 12 &&
      item.py <= height - 12;
    text.attr("x", 0).attr("text-anchor", "middle");
    if ((!named.has(item.place) && !forced) || !onMap) {
      text.attr("opacity", 0);
      continue;
    }
    const labelWidth = item.node.getComputedTextLength();
    const box = {
      x: item.px - labelWidth / 2,
      y: item.py - 8,
      w: labelWidth,
      h: 14,
    };
    const collides =
      !forced &&
      labeled.some(
        (other) =>
          !(
            box.x + box.w < other.x ||
            other.x + other.w < box.x ||
            box.y + box.h < other.y ||
            other.y + other.h < box.y
          ),
      );
    if (collides) {
      text.attr("opacity", 0);
      continue;
    }
    if (!forced) labeled.push(box);
    text.attr("opacity", 1);
  }
}

function applyYear(year, animate) {
  currentYear = year;
  yearLabel.textContent = year;
  slider.value = year;
  slider.setAttribute("aria-valuenow", String(year));
  const key = String(year);
  const fillFor = (feature) =>
    feature.place ? colorOf(feature.place.byYear[key].total) : "#f4f1ea";

  countrySel.select("title").text((feature) => {
    if (!feature.place) return "";
    return `${feature.place.label}, ${year}: ${totalFormat(feature.place.byYear[key].total)}`;
  });

  const shapes = animate
    ? countrySel.transition().duration(450)
    : countrySel.interrupt();
  shapes.attr("fill", fillFor);
  refreshLabels();
  if (hovered) {
    const stats = hovered.byYear[key];
    document.getElementById("card-name").textContent =
      `${hovered.label} · ${year}`;
    document.getElementById("card-total").textContent =
      `Total ${totalFormat(stats.total)}`;
    document.getElementById("card-avg").textContent = avgFormat(stats.avg);
    drawIndustryChart(stats.top);
  }
}

function drawColorLegend() {
  const stops = d3.range(0, 1.001, 0.08).map((t) => {
    return `${colorOf(t * maxTotal)} ${(t * 100).toFixed(0)}%`;
  });
  document.getElementById("ramp").style.background =
    `linear-gradient(to right, ${stops.join(", ")})`;
  document.getElementById("ramp-low").textContent = "0";
  document.getElementById("ramp-high").textContent =
    d3.format(",.0f")(maxTotal);
}

function layout(animate) {
  width = mapNode.clientWidth;
  height = mapNode.clientHeight;

  svg.attr("width", width).attr("height", height);
  projection.fitExtent(
    [
      [18, 12],
      [width - 18, height - 12],
    ],
    landFeature,
  );
  svg.select("rect.ocean").attr("width", width).attr("height", height);
  countrySel.attr("d", path);
  labelSel.attr("transform", (place) => {
    const [x, y] = projection([place.lon, place.lat]);
    return `translate(${x},${y})`;
  });
  applyYear(currentYear, animate);
  drawColorLegend();
}

function draw() {
  svg = d3
    .select("#map")
    .append("svg")
    .attr("role", "img")
    .attr(
      "aria-label",
      "World map of CO2 emissions by country. Country color shows the selected year.",
    );

  svg.append("rect").attr("class", "ocean").attr("fill", "#c5ddf0");

  countrySel = svg
    .append("g")
    .attr("class", "countries")
    .selectAll("path")
    .data(landFeature.features, (feature) => feature.id)
    .join("path")
    .attr("class", (feature) =>
      feature.place ? "country has-data" : "country",
    )
    .attr("fill", "#f4f1ea");

  countrySel.filter((feature) => feature.place).append("title");

  countrySel
    .filter((feature) => feature.place)
    .on("mouseenter", (event, feature) => {
      hovered = feature.place;
      d3.select(event.currentTarget)
        .raise()
        .attr("stroke", "#1f2937")
        .attr("stroke-width", 1.4);
      svg.select("g.labels").raise();
      showCard(event, feature.place);
      refreshLabels();
    })
    .on("mousemove", (event) => moveCard(event))
    .on("mouseleave", (event) => {
      hovered = null;
      d3.select(event.currentTarget)
        .attr("stroke", "#d3cdc3")
        .attr("stroke-width", 0.5);
      hideCard();
      refreshLabels();
    });

  labelSel = svg
    .append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(places, (place) => place.csv)
    .join("text")
    .attr("class", "place-label")
    .attr("dy", "0.32em")
    .attr("opacity", 0)
    .text((place) => place.label);

  layout(false);
  legendNode.hidden = false;
  statusNode.remove();
}

function stopPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  playButton.textContent = "Play";
}

function startPlay() {
  if (playTimer) {
    stopPlay();
    return;
  }
  let year = currentYear >= YEAR_MAX ? YEAR_MIN : currentYear;
  if (currentYear >= YEAR_MAX) applyYear(year, true);
  playButton.textContent = "Pause";
  playTimer = setInterval(() => {
    year += 1;
    if (year > YEAR_MAX) {
      stopPlay();
      return;
    }
    applyYear(year, true);
  }, 700);
}

function drawIndustryFilter(rows) {
  let filter_area = document.querySelector("#industries");
  let industries = Array.from(d3.group(rows, (d) => d.INDUSTRY).keys()).sort();
  filter_area.insertAdjacentHTML(
    "afterbegin",
    `
  	<option class='selected' value="" selected>All</option>
  	${industries.map((c) => `<option value="${c}">${c}</option>`).join("")}
  	`,
  );
}

slider.addEventListener("input", () => {
  stopPlay();
  applyYear(+slider.value, true);
});
playButton.addEventListener("click", startPlay);
document.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (
    event.target &&
    event.target.tagName === "INPUT" &&
    event.target.type !== "range"
  ) {
    return;
  }
  event.preventDefault();
  stopPlay();
  const step = event.key === "ArrowRight" ? 1 : -1;
  applyYear(Math.max(YEAR_MIN, Math.min(YEAR_MAX, currentYear + step)), true);
});

window.addEventListener("resize", () => {
  if (!svg) return;
  layout(false);
});

industrySelect.addEventListener("change", (e) => {
  currentIndustry = e.target.value;
  main(file);
});

dataSelect.addEventListener("change", (e) => {
  if (e.target.checked) file = "./CO2_emissions_per_capita.csv";
  else file = "../../CO2_emissions.csv";
  main(file);
});

function main(file) {
  d3.select("#map").selectAll("svg").remove();
  Promise.all([
    d3.csv(file),
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json"),
  ])
    .then(([rows, world]) => {
      if (flag) {
        drawIndustryFilter(rows);
        flag = false;
      }
      if (currentIndustry !== "")
        rows = rows.filter((d) => d.INDUSTRY === currentIndustry);
      places = preparePlaces(rows, world);
      maxTotal = d3.max(places, (place) =>
        d3.max(YEARS, (year) => place.byYear[year].total),
      );
      draw();
    })
    .catch((error) => {
      console.error(error);
      statusNode.textContent =
        "Could not load the map. Open this page from a local web server so the CSV can be read.";
    });
}

main("../../CO2_emissions.csv");
