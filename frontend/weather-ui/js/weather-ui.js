(() => {
  "use strict";

  const spriteRows = {
    sun: [
      ".....YYY.......",
      "...YYYYYYYYY...",
      "..YYYYYYYYYYY..",
      ".YYYYYYYYYYYYY.",
      "YYYYYYYYYYYYYYY",
      "YYYYYYYYYYYYYYY",
      "YYYYYYYYYYYYYYY",
      ".YYYYYYYYYYYYY.",
      "..YYYYYYYYYYY..",
      "...YYYYYYYYY...",
      ".....YYY......."
    ],
    partly: [
      ".....YYY.......",
      "...YYYYYYYYY...",
      "..YYYYYYYYYYY..",
      ".YYYYYYYYYYYYY.",
      "YYYYYYYYYYYYYYY",
      "YYCCYYYYYYYYY..",
      "YCCCCCCYYYY....",
      "CCCCCCCCCCC....",
      "CCCCCCCCCCCCCC.",
      ".CCCCCCCCCCCCC.",
      "..ccccccccccc.."
    ],
    cloud: [
      ".......CCCC....",
      ".....CCCCCCCC..",
      "....CCCCCCCCCC.",
      "...CCCCCCCCCCCC",
      ".CCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCC",
      ".CCCCCCCCCCCCCC",
      "..cccccccccccc."
    ],
    rain: [
      ".......CCCC....",
      ".....CCCCCCCC..",
      "....CCCCCCCCCC.",
      "...CCCCCCCCCCCC",
      ".CCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCC",
      "CCCCCCCCCCCCCCC",
      ".CCCCCCCCCCCCCC",
      "..cccccccccccc.",
      "...B....B....B.",
      "....B....B....B",
      "...B....B....B."
    ]
  };
  const spriteColors = { Y: "#ffc96f", C: "#eaf1df", c: "#add9c6", B: "#71ddd2" };
  const svgNS = "http://www.w3.org/2000/svg";

  const spriteMarkup = (kind) => {
    const rows = spriteRows[kind] || spriteRows.cloud;
    const columns = Math.max(...rows.map((row) => row.length));
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${columns} ${rows.length}`);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    rows.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (!spriteColors[pixel]) return;
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", 1);
        rect.setAttribute("height", 1);
        rect.setAttribute("fill", spriteColors[pixel]);
        svg.append(rect);
      });
    });
    return svg;
  };

  const makeWeatherSprite = (kind, label = "") => {
    const allowed = ["sun", "partly", "cloud", "rain"];
    const safeKind = allowed.includes(kind) ? kind : "cloud";
    const node = document.createElement("span");
    node.className = `weather-sprite sprite-small-${safeKind}`;
    node.setAttribute("aria-hidden", "true");
    if (label) node.title = label;
    node.append(spriteMarkup(safeKind));
    return node;
  };

  const localTimeLabel = (timezone) => {
    const date = new Date();
    const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: timezone }).format(date);
    const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(date);
    return `${weekday} · ${time}`;
  };

  const formatTemperature = (celsius, unit) => {
    const value = unit === "f" ? Math.round(celsius * 9 / 5 + 32) : celsius;
    return `${Math.round(value)}°`;
  };

  window.WeatherUI = Object.freeze({ makeWeatherSprite, spriteMarkup, localTimeLabel, formatTemperature });
})();
