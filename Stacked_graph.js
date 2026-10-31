const file = await fetch("./CO2_emissions.csv");
const content = await file.text();

const [headers, ...lines] = content.trim().split(/\r?\n/);
const keys = headers.split(",");
const include = [
  '"COUNTRY"',
  '"INDICATOR"',
  '"INDUSTRY"',
  '"1995"',
  '"1996"',
  '"1997"',
  '"1998"',
  '"1999"',
  '"2000"',
  '"2001"',
  '"2002"',
  '"2003"',
  '"2004"',
  '"2005"',
  '"2006"',
  '"2007"',
  '"2008"',
  '"2009"',
  '"2010"',
  '"2011"',
  '"2012"',
  '"2013"',
  '"2014"',
  '"2015"',
  '"2016"',
  '"2017"',
  '"2018"',
];
const indexes = include.map((c) => keys.indexOf(c));

const data = lines
  .filter((line) => line.includes("CO2 emissions, Metric ton of CO₂"))
  .map((line) => {
    const val = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return Object.fromEntries(
      include.map((c, i) => [
        c.replace(/^"|"$/g, ""),
        val[indexes[i]].replace(/^"|"$/g, ""),
      ]),
    );
  });

const margin = { top: 20, right: 30, bottom: 30, left: 60 };
const width = 1000 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const forCountry = d3.rollups(
  data,
  (v) => v,
  (d) => d.COUNTRY,
);

const trendData = forCountry.flatMap(([country, lines]) =>
  yearsList.map((year) => ({
    country,
    year: +year,
    total: d3.sum(lines, (d) => d[year]),
  })),
);

console.log(trendData);

const svg = d3
  .select("#chart-area")
  .append("svg")
  .attr(
    "viewBox",
    `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`,
  )
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3
  .scaleLinear()
  .domain(d3.extent(trendData, (d) => d.year))
  .range([0, width]);
const y = d3
  .scaleLinear()
  .domain([0, d3.max(trendData, (d) => d.total) * 1.1])
  .range([height, 0]);

// Axis
svg
  .append("g")
  .attr("class", "grid-line")
  .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(6));
svg
  .append("g")
  .attr("transform", `translate(0,${height})`)
  .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(12));
svg.append("g").call(d3.axisLeft(y));

svg
  .append("text")
  .attr("x", width / 2)
  .attr("y", height + 40)
  .attr("text-anchor", "middle")
  .attr("fill", "#94a3b8")
  .text("Year");

svg
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -margin.left + 15)
  .attr("text-anchor", "middle")
  .attr("fill", "#94a3b8")
  .text("CO₂ emissions (metric tons)");

const area = d3
  .area()
  .x((d) => x(d.year))
  .y0(height)
  .y1((d) => y(d.total))
  .curve(d3.curveMonotoneX);

const finalData = d3.group(trendData, (d) => d.country);
const countries = Array.from(finalData.keys()).sort();
let filtered_countries = countries;
const color = d3.scaleOrdinal(d3.schemeTableau10).domain(countries);
const line = d3
  .line()
  .x((d) => x(d.year))
  .y((d) => y(d.total))
  .curve(d3.curveMonotoneX);

let graph_area = document.querySelector("#chart-area");
graph_area.insertAdjacentHTML(
  "afterbegin",
  `
	<label class="color-scheme">
		Country:
		<select id = 'countries' multiple >
			<option class='selected' value="" selected>All</option>
			${countries.map((c) => `<option value="${c}">${c}</option>`).join("")}
		</select>
	</label>`,
);
let select = document.querySelector("#countries");
let wasAll = true;

select.addEventListener("change", (e) => {
  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
  const allOption = select.querySelector('option[value=""]');
  const specific = selected.filter((v) => v !== "");
  const hasAll = selected.includes("");

  if (hasAll && specific.length > 0) {
    if (wasAll) {
      allOption.selected = false;
      filtered_countries = specific;
      wasAll = false;
    } else {
      Array.from(select.options).forEach((o) => {
        o.selected = o.value === "";
      });
      filtered_countries = countries;
      wasAll = true;
    }
  } else if (specific.length === 0) {
    allOption.selected = true;
    filtered_countries = countries;
    wasAll = true;
  } else {
    filtered_countries = specific;
    wasAll = false;
  }

  draw_graph();
});

function draw_graph() {
  svg.selectAll(".country-path, .country-defs").remove();

  [...finalData]
    .filter(([country]) => filtered_countries.includes(country))
    .forEach(([country, values], idx) => {
      const sorted = values.slice().sort((a, b) => a.year - b.year);

      svg
        .append("path")
        .attr("class", "country-path")
        .datum(sorted)
        .attr("fill", `url(#gradient-${idx})`)
        .attr("d", area);

      svg
        .append("path")
        .attr("class", "country-path")
        .datum(sorted)
        .attr("fill", "none")
        .attr("stroke", color(country))
        .attr("stroke-width", 2)
        .attr("d", line);

      const defs = svg.append("defs").attr("class", "country-defs");
      const gradient = defs
        .append("linearGradient")
        .attr("id", `gradient-${idx}`)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color(country));
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color(country))
        .attr("stop-opacity", 0.05);

      svg
        .append("path")
        .attr("class", "country-path")
        .datum(sorted)
        .attr("fill", "none")
        .attr("stroke", color(country))
        .attr("stroke-width", 2)
        .attr("d", line);
    });

  // Interactive Elements
  const focusGroup = svg.append("g").style("display", "none");

  const verticalLine = focusGroup
    .append("line")
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#64748b")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4");

  const years = yearsList.map(Number);
  const bisectYear = d3.bisector((y) => y).center;
  const bisect = d3.bisector((d) => d.year).left;

  const circles = focusGroup
    .selectAll("circle.country-dot")
    .data(filtered_countries)
    .join("circle")
    .attr("class", "country-dot")
    .attr("r", 4)
    .attr("fill", (c) => color(c))
    .attr("stroke", "white");

  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("mouseover", () => focusGroup.style("display", null))
    .on("mouseout", () => {
      focusGroup.style("display", "none");
      hideTooltip();
    })
    .on("mousemove", function (event) {
      const x0 = x.invert(d3.pointer(event)[0]);
      const year = years[bisectYear(years, x0)];

      // valor de cada país en ese año
      const rows = filtered_countries
        .map((c) => ({
          country: c,
          total: finalData.get(c)?.find((d) => d.year === year)?.total,
        }))
        .filter((r) => r.total != null);

      focusGroup.attr("transform", `translate(${x(year)},0)`);
      circles.attr("cy", (c) => {
        const r = rows.find((r) => r.country === c);
        return r ? y(r.total) : -100; // fuera de vista si no hay dato
      });

      const lines = rows
        .sort((a, b) => b.total - a.total)
        .map(
          (r) =>
            `<div><span style="color:${color(r.country)}">●</span> ${r.country}: <span class="font-mono">${r.total.toFixed(2)}</span></div>`,
        )
        .join("");

      showTooltip(
        event,
        `<div class="font-bold text-center mb-1 border-b border-slate-700 pb-1">${year}</div>${lines}`,
      );
    });
}

draw_graph();
