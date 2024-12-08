function toggleMap() {
    const overlay = document.getElementById("map-overlay");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        overlay.classList.remove("hidden");
        overlay.classList.add("visible");

        // Render the graph when the overlay becomes visible
        renderGraph();
    } else {
        overlay.classList.remove("visible");
        overlay.classList.add("hidden");
    }
}

// Load data
let umapData = null; // Store the UMAP data here
let dataLoaded = false;
let graphInitialized = false;

function fetchData() {
    return fetch("/assets/umap.json")
        .then(response => response.json())
        .then(data => {
            umapData = data; // Store data globally
            dataLoaded = true;
            console.log("UMAP data loaded:", data);
        })
        .catch(error => console.error("Error loading UMAP data:", error));
}


// Fetch and render the UMAP map
function renderGraph() {
    if (!umapData) {
        console.error("UMAP data is not loaded yet! Waiting for data...");
        fetchData().then(() => {
            renderGraph(); // Retry rendering after data loads
        });
        return;
    }

    if (graphInitialized) {
        console.log("Graph already initialized.");
        return;
    }

    const dot_radius_default = 5;
    const dot_radius_hover = 8;
    const margin_x = 50;
    const margin_y = 25;
    const container = document.getElementById("map-container");
    const width = container.offsetWidth;
    const height = container.offsetHeight;


    const svg = d3.select("#map-container")
                  .append("svg")
                  .attr("width", width)
                  .attr("height", height)
                  .attr("viewBox", `0 0 ${width} ${height}`)
                  .attr("preserveAspectRatio", "xMidYMid meet");

    const xScale = d3.scaleLinear()
                     .domain(d3.extent(umapData, d => d.x))
                     .range([margin_x, width - margin_x]);

    const yScale = d3.scaleLinear()
                     .domain(d3.extent(umapData, d => d.y))
                     .range([margin_y, height - margin_y]);

    // Add gridlines
    const gridlines = svg.append("g").attr("class", "map-grid");
    gridlines.selectAll("line.horizontal")
             .data(yScale.ticks(10))
             .enter()
             .append("line")
             .attr("x1", margin_x)
             .attr("x2", width - margin_x)
             .attr("y1", d => yScale(d))
             .attr("y2", d => yScale(d));

    gridlines.selectAll("line.vertical")
             .data(xScale.ticks(10))
             .enter()
             .append("line")
             .attr("x1", d => xScale(d))
             .attr("x2", d => xScale(d))
             .attr("y1", margin_y)
             .attr("y2", height - margin_y);

    // Add tooltip div
    const tooltip = d3.select("body")
                      .append("div")
                      .style("position", "absolute")
                      .style("background-color", "white")
                      .style("border", "1px solid #ccc")
                      .style("padding", "5px")
                      .style("border-radius", "5px")
                      .style("box-shadow", "0px 2px 5px rgba(0, 0, 0, 0.2)")
                      .style("pointer-events", "none")
                      .style("z-index", 1000) // Ensure tooltip appears above other elements
                      .style("opacity", 0);

    // Render circles for all nodes
    svg.selectAll("circle")
       .data(umapData)
       .enter()
       .append("circle")
       .attr("cx", d => xScale(d.x))
       .attr("cy", d => yScale(d.y))
       .attr("r", dot_radius_default)
       .attr("fill", d => d.slug === CURRENT_FILE ? "red" : "#1f3939")
       .attr("class", "semantic-dot") // Add a shared class for all dots
       .attr("data-slug", d => d.slug) // Add a unique identifier for each dot
       .style("cursor", "pointer")
       .on("mouseover", function(event, d) {
           d3.select(this).attr("r", dot_radius_hover); // Enlarge dot on hover
           tooltip.style("opacity", 1)
                  .html(`<strong>${d.title}</strong>`)
                  .style("left", `${event.pageX + 10}px`)
                  .style("top", `${event.pageY + 10}px`);
       })
       .on("mousemove", function(event) {
           tooltip.style("left", `${event.pageX + 10}px`)
                  .style("top", `${event.pageY + 10}px`);
       })
       .on("mouseout", function() {
           d3.select(this).attr("r", dot_radius_default); // Reset dot size
           tooltip.style("opacity", 0);
       })
       .on("click", function(event, d) {
           window.location.href = `/${d.slug}`; // Navigate to file
       });

    graphInitialized = true; // Mark graph as initialized
    console.log("Graph initialized.");
}

window.addEventListener("resize", () => {
    const overlay = document.getElementById("map-overlay");
    if (!overlay.classList.contains("visible")) return; // Only update if visible

    const container = document.getElementById("map-container");
    const svg = d3.select("#map-container svg");
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    // Recalculate scales
    const xScale = d3.scaleLinear()
                    .domain(d3.extent(umapData, d => d.x))
                    .range([50, width - 50]);

    const yScale = d3.scaleLinear()
                    .domain(d3.extent(umapData, d => d.y))
                    .range([50, height - 50]);

    svg.attr("width", width)
       .attr("height", height)
       .attr("viewBox", `0 0 ${width} ${height}`);

    // Update circles
    svg.selectAll("circle")
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y));

    // Update gridlines
    svg.selectAll("line.horizontal")
    .attr("x1", 50)
    .attr("x2", width - 50)
    .attr("y1", d => yScale(d))
    .attr("y2", d => yScale(d));

    svg.selectAll("line.vertical")
    .attr("x1", d => xScale(d))
    .attr("x2", d => xScale(d))
    .attr("y1", 50)
    .attr("y2", height - 50);

    console.log(`window resized: ${width} ${height}`)
});

document.addEventListener("DOMContentLoaded", () => {
    const currentFile = CURRENT_FILE || "index.md";

    if (currentFile === "index.md") {
        console.log("Rendering graph for index page...");
        fetchData().then(() => {
            renderGraph(); // Ensure data is loaded before rendering
            document.getElementById("map-overlay").classList.add("visible");
        });
    } else {
        console.log("Fetching data for other pages...");
        fetchData(); // Preload data for other pages
    }
});