/*  Dimensions  */
const margin = {top: 20, right: 30, bottom: 35, left: 70},
      width  = 900 - margin.left - margin.right,
      height = 500 - margin.top  - margin.bottom;

const svg = d3.select("#chart")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().range([0, width]);
const yScale = d3.scaleLinear().range([height, 0]);
const xAxis  = d3.axisBottom(xScale);
const yAxis  = d3.axisLeft(yScale);

svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
svg.append("g").attr("class", "y-axis");

const lineGen = d3.line()
  .x(d => xScale(d.time))
  .y(d => yScale(d.bp));

const color = d3.scaleOrdinal(d3.schemeTableau10);

const crosshair = svg.append("line")
  .attr("class", "crosshair")
  .attr("stroke", "#aaa")
  .attr("stroke-width", 1)
  .attr("stroke-dasharray", "2 2")
  .attr("y1", 0)
  .attr("y2", height)
  .style("opacity", 0);


/* ---------- MAIN ---------- */
d3.json("processed_data.json").then(data => {

  /* --- populate group selector --- */
  const groups = Array.from(new Set(data.map(d => d.group)));
  const groupSel = d3.select("#group-select");
  groupSel.selectAll("option")
          .data(groups)
          .enter().append("option")
          .text(d => d);

  /* --- dependent rat selector --- */
  const ratSel = d3.select("#rat-select");
  groupSel.on("change", () => updateRatMenu(groupSel.property("value")));
  updateRatMenu(groups[0]); // initial load

  d3.select("#trend-toggle").on("change", redraw);
  d3.select("#legend-toggle").on("change", () => {
    d3.select("#legend").style("display",
      d3.select("#legend-toggle").property("checked") ? "block" : "none");
  });

  function updateRatMenu(groupName){
    const rats = data.filter(d => d.group === groupName);
    ratSel.selectAll("option").remove();
    ratSel.selectAll("option")
          .data(rats)
          .enter().append("option")
          .attr("value", d => d.rat_id)
          .text(d => d.rat_id);
    ratSel.on("change", redraw);
    redraw(); // draw with first rat of this group
  }




  function redraw(){
    const groupName = groupSel.property("value");
    const ratId     = ratSel.property("value");
    const ratData   = data.find(d => d.group === groupName && d.rat_id === ratId);

    /* Domains */
    xScale.domain(d3.extent(ratData.values, d => d.time));
    yScale.domain(d3.extent(ratData.values, d => d.bp)).nice();

    svg.select(".x-axis").transition().call(xAxis);
    svg.select(".y-axis").transition().call(yAxis);

    /* ----- DATA JOIN (single line) ----- */
    const path = svg.selectAll(".bp-line")
      .data([ratData.values], d => ratId);

    path.enter().append("path")
        .attr("class", "bp-line")
        .attr("stroke", color(ratId))
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
      .merge(path)
        .transition()
        .attr("d", lineGen);

    path.exit().remove();

    /* ----- Trend-line ----- */
    const showTrend = d3.select("#trend-toggle").property("checked");

    const trendData = showTrend ? [ratData] : [];

    const trendSel = svg.selectAll(".trend").data(trendData);
    
    // ENTER
    const trendEnter = trendSel.enter().append("line")
      .attr("class", "trend")
      .attr("stroke-dasharray", "4 4")
      .attr("stroke", color(ratId))
      .attr("stroke-width", 2)
      .attr("pointer-events", "stroke") // 👈 ensures mouse can interact with thin line
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(150).style("opacity", 1);
        tooltip.html(`
          <strong>Trendline</strong><br>
          <strong>Slope:</strong> ${d.slope.toFixed(4)}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(150).style("opacity", 0);
      });
    
    // ENTER + UPDATE
    trendEnter.merge(trendSel)
      .transition()
      .attr("x1", xScale(ratData.values[0].time))
      .attr("y1", yScale(ratData.values[0].bp))
      .attr("x2", xScale(ratData.values.at(-1).time))
      .attr("y2", yScale(
          ratData.values[0].bp +
          ratData.slope * (ratData.values.at(-1).time - ratData.values[0].time)
      ));
    
    trendSel.exit().remove();
    

    // ✅ ✅ ✅ Tooltip Code (inserted here)
    const tooltip = d3.select("#tooltip");

    const circles = svg.selectAll(".bp-dot").data(ratData.values);

    circles.enter()
      .append("circle")
      .attr("class", "bp-dot")
      .attr("r", 4)
      .attr("fill", color(ratId))
      .merge(circles)
      .attr("cx", d => xScale(d.time))
      .attr("cy", d => yScale(d.bp))
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(150).style("opacity", 1);
        tooltip.html(`
          <strong>Rat:</strong> ${ratId}<br>
          <strong>Time:</strong> ${d.time}<br>
          <strong>BP:</strong> ${d.bp.toFixed(2)}
        `)
        const [pageX, pageY] = [event.pageX, event.pageY];
        const tooltipBox = tooltip.node().getBoundingClientRect();
        const offset = 12;
        let left = pageX + offset;
        let top = pageY - tooltipBox.height - offset;

// If tooltip would go off right edge
if (left + tooltipBox.width > window.innerWidth) {
  left = pageX - tooltipBox.width - offset;
}

tooltip.style("left", `${left}px`).style("top", `${top}px`);

      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(150).style("opacity", 0);
      });

    circles.exit().remove();

    /* ----- Legend ----- */
    d3.select("#legend").html(`
      <strong>Legend</strong><br>
      <span style="color:${color(ratId)};">&#9632;</span> ${ratId}
    `);

    // Trendline tooltip on hover
    svg.selectAll(".trend")
    .on("mouseover", (event, d) => {
    tooltip.transition().duration(150).style("opacity", 1);
    tooltip.html(`
        <strong>Trendline</strong><br>
        <strong>Slope:</strong> ${d.slope.toFixed(4)}
    `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", (event) => {
    tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
    tooltip.transition().duration(150).style("opacity", 0);
    });

    svg.on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const timeVal = xScale.invert(mx);
      
        crosshair
          .attr("x1", mx)
          .attr("x2", mx)
          .style("opacity", 1);
      
      }).on("mouseout", () => {
        crosshair.style("opacity", 0);
      });

      // Axis Labels
    svg.selectAll(".x-label").data([1]).join("text")
    .attr("class", "x-label")
    .attr("x", width / 2)
    .attr("y", height + 30)
    .attr("text-anchor", "middle")
    .text("Time");

    svg.selectAll(".y-label").data([1]).join("text")
    .attr("class", "y-label")
    .attr("transform", `rotate(-90)`)
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Blood Pressure (mmHg)");
}



});
