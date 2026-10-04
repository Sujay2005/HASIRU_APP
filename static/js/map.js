/* ========================================================= */
/* MAP TILE LAYERS                                           */
/* ========================================================= */

var lightMap = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '© OpenStreetMap'
    }
);


/* ========================================================= */
/* DARK MAP                                                  */
/* ========================================================= */

var darkMap = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '© OpenStreetMap'
    }
);


/* ========================================================= */
/* MAP INITIALIZATION                                        */
/* ========================================================= */

var map = L.map('map', {
    layers: [lightMap]
}).setView([12.97, 77.59], 11);


/* ========================================================= */
/* AQI CLICK ESTIMATOR                                       */
/* ========================================================= */

map.on('contextmenu', function(e) {

    let lat = e.latlng.lat;
    let lon = e.latlng.lng;

    fetch(`/estimate/${lat}/${lon}`)

        .then(response => response.json())

        .then(data => {

            L.popup()

                .setLatLng([lat, lon])

                .setContent(

                    "<b>Estimated AQI</b><br>" +

                    "AQI : " +
                    data.aqi +

                    "<br>" +

                    "Category : " +
                    data.category

                )

                .openOn(map);

        })

        .catch(error => {

            console.error(
                "AQI estimation error:",
                error
            );

        });

});


/* ========================================================= */
/* AQI LEGEND                                               */
/* ========================================================= */

var legend = L.control({
    position: 'bottomright'
});


/* ========================================================= */
/* LEGEND STATE                                             */
/* ========================================================= */

var legendMinimized = false;


/* ========================================================= */
/* LEGEND CONTROL                                            */
/* ========================================================= */

legend.onAdd = function() {

    var div = L.DomUtil.create(
        'div',
        'legend'
    );


    /* ----------------------------------------------------- */
    /* PREVENT MAP CLICK / DRAG THROUGH LEGEND              */
    /* ----------------------------------------------------- */

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);


    /* ----------------------------------------------------- */
    /* LEGEND STYLE                                          */
    /* ----------------------------------------------------- */

    div.style.position =
        'relative';

    div.style.minWidth =
        '165px';

    div.style.boxSizing =
        'border-box';

    div.style.transition =
        'all 0.2s ease';


    /* ----------------------------------------------------- */
    /* LEGEND HTML                                           */
    /* ----------------------------------------------------- */

    div.innerHTML =

        "<div " +
            "class='legend-header' " +
            "style='" +

                "display:flex;" +
                "align-items:center;" +
                "justify-content:space-between;" +

                "gap:8px;" +

                "font-weight:700;" +
                "font-size:11px;" +

                "padding-bottom:7px;" +

                "border-bottom:1px solid " +
                "rgba(255,255,255,0.35);" +

                "margin-bottom:7px;" +

            "'" +
        ">" +

            "<span>" +
                "AQI LEGEND" +
            "</span>" +

            "<button " +

                "id='aqiLegendToggle' " +

                "type='button' " +

                "title='Minimize legend' " +

                "aria-label='Minimize AQI legend' " +

                "style='" +

                    "width:24px;" +
                    "height:24px;" +

                    "padding:0;" +

                    "margin:0;" +

                    "border:0;" +

                    "border-radius:6px;" +

                    "background:rgba(255,255,255,0.10);" +

                    "color:#ffffff;" +

                    "font-size:17px;" +

                    "font-weight:600;" +

                    "line-height:22px;" +

                    "display:flex;" +

                    "align-items:center;" +

                    "justify-content:center;" +

                    "cursor:pointer;" +

                "'" +

            ">" +

                "−" +

            "</button>" +

        "</div>" +


        "<div id='aqiLegendContent'>" +


            /* GOOD */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot good' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#00e400;" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Good" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "0–50" +
                "</span>" +

            "</div>" +


            /* SATISFACTORY */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot satisfactory' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#ffff00;" +
                        "border:1px solid rgba(0,0,0,0.25);" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Satisfactory" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "51–100" +
                "</span>" +

            "</div>" +


            /* MODERATE */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot moderate' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#ff7e00;" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Moderate" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "101–200" +
                "</span>" +

            "</div>" +


            /* POOR */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot poor' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#ff0000;" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Poor" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "201–300" +
                "</span>" +

            "</div>" +


            /* VERY POOR */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot very-poor' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#8f3f97;" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Very Poor" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "301–400" +
                "</span>" +

            "</div>" +


            /* SEVERE */

            "<div class='legend-item' " +
                "style='" +
                    "display:flex;" +
                    "align-items:center;" +
                    "gap:7px;" +
                    "margin:6px 0;" +
                    "font-size:10px;" +
                "'>" +

                "<span " +
                    "class='legend-dot severe' " +
                    "style='" +
                        "display:inline-block;" +
                        "width:10px;" +
                        "height:10px;" +
                        "min-width:10px;" +
                        "border-radius:50%;" +
                        "background:#7e0023;" +
                    "'>" +
                "</span>" +

                "<span>" +
                    "Severe" +
                "</span>" +

                "<span " +
                    "class='legend-range' " +
                    "style='margin-left:auto;'>" +
                    "401+" +
                "</span>" +

            "</div>" +


        "</div>";


    /* ===================================================== */
    /* MINIMIZE / MAXIMIZE BUTTON                            */
    /* ===================================================== */

    var toggleButton =
        div.querySelector(
            '#aqiLegendToggle'
        );


    var legendContent =
        div.querySelector(
            '#aqiLegendContent'
        );


    toggleButton.addEventListener(
        'click',
        function(event) {

            event.preventDefault();

            event.stopPropagation();


            legendMinimized =
                !legendMinimized;


            if (legendMinimized) {

                /* ----------------------------------------- */
                /* MINIMIZED                                */
                /* ----------------------------------------- */

                legendContent.style.display =
                    'none';


                div.style.minWidth =
                    '130px';


                div.style.padding =
                    '8px 10px';


                toggleButton.innerHTML =
                    '+';


                toggleButton.title =
                    'Maximize legend';


                toggleButton.setAttribute(
                    'aria-label',
                    'Maximize AQI legend'
                );

            }

            else {

                /* ----------------------------------------- */
                /* MAXIMIZED                                */
                /* ----------------------------------------- */

                legendContent.style.display =
                    'block';


                div.style.minWidth =
                    '165px';


                div.style.padding =
                    '10px 12px';


                toggleButton.innerHTML =
                    '−';


                toggleButton.title =
                    'Minimize legend';


                toggleButton.setAttribute(
                    'aria-label',
                    'Minimize AQI legend'
                );

            }

        }
    );


    return div;

};


legend.addTo(map);