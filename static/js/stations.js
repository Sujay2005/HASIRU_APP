/* ========================================================= */
/* AQI STATIONS                                              */
/* ========================================================= */

let stationLayer = L.layerGroup().addTo(map);


/* ========================================================= */
/* LOAD AQI STATIONS                                         */
/* ========================================================= */

fetch('/aqi_points')

.then(response => {

    if (!response.ok) {
        throw new Error(
            "Failed to load AQI stations"
        );
    }

    return response.json();

})

.then(data => {


    /* ----------------------------------------------------- */
    /* Populate Trends station dropdown                      */
    /* ----------------------------------------------------- */

    populateTrendStations(data);


    /* ----------------------------------------------------- */
    /* Create station markers                                */
    /* ----------------------------------------------------- */

    data.forEach(point => {


        let color = "green";


        if (point.aqi > 50)
            color = "yellow";


        if (point.aqi > 100)
            color = "orange";


        if (point.aqi > 150)
            color = "red";


        if (point.aqi > 200)
            color = "purple";


        if (point.aqi > 300)
            color = "maroon";


        /* ------------------------------------------------- */
        /* Station marker                                    */
        /* ------------------------------------------------- */

        L.circleMarker(

            [point.lat, point.lon],

            {

                radius: 8,

                color: color,

                fillColor: color,

                fillOpacity: 0.9

            }

        )

        .bindPopup(

            "<b>" +
            escapeHTML(point.device) +
            "</b><br>" +

            "AQI : " +
            point.aqi

        )

        .addTo(stationLayer);


    });

})


.catch(error => {

    console.error(
        "AQI station loading error:",
        error
    );

});


/* ========================================================= */
/* POPULATE TRENDS DROPDOWN                                  */
/* ========================================================= */

function populateTrendStations(data) {

    const select =
        document.getElementById(
            "trendStation"
        );


    if (!select) {

        console.warn(
            "trendStation dropdown not found."
        );

        return;

    }


    /* ----------------------------------------------------- */
    /* Clear existing options                                */
    /* ----------------------------------------------------- */

    select.innerHTML = "";


    /* ----------------------------------------------------- */
    /* Default option                                        */
    /* ----------------------------------------------------- */

    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";

    defaultOption.textContent =
        "Select station";


    select.appendChild(
        defaultOption
    );


    /* ----------------------------------------------------- */
    /* Add stations                                          */
    /* ----------------------------------------------------- */

    data.forEach(point => {

        const option =
            document.createElement("option");


        option.value =
            point.device;


        option.textContent =
            point.device;


        select.appendChild(
            option
        );

    });

}


/* ========================================================= */
/* HTML ESCAPE HELPER                                        */
/* ========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement("div");


    div.textContent =
        String(value);


    return div.innerHTML;

}