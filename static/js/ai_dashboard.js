fetch("/system_status")

.then(r=>r.json())

.then(data=>{

document.getElementById("dashboard").innerHTML=`

<div class="grid">

<div class="card">

<h2>🧠 AI Engine Status</h2>

<div class="info">

<span>Current Time</span>

<span class="value">${data.current_time}</span>

</div>

<div class="info">

<span>Latest Database</span>

<span class="value">${data.latest_timestamp}</span>

</div>

<div class="info">

<span>Difference</span>

<span class="value">${data.hours_difference} hrs</span>

</div>

<div class="info">

<span>Mode</span>

<span class="${data.mode.includes("Predicted")?"status-warning":"status-good"}">

${data.mode}

</span>

</div>

</div>

<div class="card">

<h2>🤖 AI Model</h2>

<div class="info">

<span>Model</span>

<span class="value">${data.model}</span>

</div>

<div class="info">

<span>MAE</span>

<span class="value">${data.mae}</span>

</div>

<div class="info">

<span>R² Score</span>

<span class="value">${data.r2}</span>

</div>

</div>

<div class="card">

<h2>⚙ Prediction Pipeline</h2>

<div class="pipeline">

<div>🗄 Database</div>

<div>⬇</div>

<div>🕒 Freshness Check</div>

<div>⬇</div>

<div>🧠 Random Forest</div>

<div>⬇</div>

<div>🌍 Current AQI Prediction</div>

<div>⬇</div>

<div>🗺 AQI Navigator</div>

</div>

</div>

<div class="card">

<h2>📝 AI Decision Timeline</h2>

<div id="timeline">

Loading timeline...

</div>

</div>

</div>

<div class="card">

    <h2>📍 Station Prediction Status</h2>

    <div id="stationTable">

        Loading station data...

    </div>

</div>

`;

fetch("/station_prediction_status")

.then(r=>r.json())

.then(stations=>{

    let table = `

    <table>

        <tr>

            <th>Device</th>

            <th>Last AQI</th>

            <th>Current AQI</th>

            <th>Difference</th>

            <th>Source</th>

        </tr>

    `;

    stations.forEach(s=>{

        let diff = (s.predicted_aqi - s.last_aqi).toFixed(2);

        let color = diff >= 0 ? "#d32f2f" : "#2e7d32";

        table += `

        <tr>

            <td>${s.device}</td>

            <td>${s.last_aqi}</td>

            <td>${s.predicted_aqi}</td>

            <td style="color:${color};font-weight:bold;">

                ${diff > 0 ? "+" : ""}${diff}

            </td>

            <td>${s.source}</td>

        </tr>

        `;

    });

    table += "</table>";

    document.getElementById("stationTable").innerHTML = table;
    let timelineHTML = "";

    data.timeline.forEach(step=>{

        timelineHTML += `

        <div class="timelineItem">

            <div class="timelineDot"></div>

            <div class="timelineText">

                ${step}

            </div>

        </div>

        `;

    });

    document.getElementById("timeline").innerHTML = timelineHTML;

});
});