let darkMode = false;


/* ========================================================= */
/* THEME TOGGLE                                              */
/* ========================================================= */

function toggleTheme() {

    darkMode = !darkMode;

    document.body.classList.toggle(
        "dark",
        darkMode
    );


    /* ----------------------------------------------------- */
    /* APPLY DARK MODE DIRECTLY TO MAP TILES                 */
    /* ----------------------------------------------------- */

    applyMapTheme();


    /* ----------------------------------------------------- */
    /* UPDATE THEME BUTTON                                   */
    /* ----------------------------------------------------- */

    const themeBtn =
        document.getElementById(
            "themeBtn"
        );

    if (themeBtn) {

        themeBtn.innerHTML =
            darkMode
                ? "☀"
                : "◐";

    }

}


/* ========================================================= */
/* MAP THEME                                                 */
/* ========================================================= */

function applyMapTheme() {

    if (
        typeof map === "undefined" ||
        !map
    ) {
        return;
    }


    const tilePane =
        map.getPane(
            "tilePane"
        );


    if (!tilePane) {
        return;
    }


    if (darkMode) {

        /*
         * Darken and invert the OpenStreetMap tiles.
         *
         * The inversion makes the bright map background
         * dark while hue-rotate restores natural-looking
         * map colours.
         */

        tilePane.style.filter =
            "brightness(0.55) " +
            "contrast(1.15) " +
            "invert(1) " +
            "hue-rotate(180deg)";

    } else {

        tilePane.style.filter =
            "none";

    }


    /*
     * Make sure Leaflet redraws the map correctly
     * after the theme changes.
     */

    setTimeout(function () {

        if (
            typeof map.invalidateSize ===
            "function"
        ) {

            map.invalidateSize();

        }

    }, 100);

}


/* ========================================================= */
/* LAYER PANEL                                                */
/* ========================================================= */

function toggleLayers() {

    const p =
        document.getElementById(
            "layerPanel"
        );

    if (!p) {
        return;
    }

    p.style.display =
        p.style.display === "block"
            ? "none"
            : "block";

}


/* ========================================================= */
/* STATION TOGGLE                                             */
/* ========================================================= */

function toggleStations() {

    if (
        typeof stationLayer ===
        "undefined"
    ) {
        return;
    }


    if (
        map.hasLayer(
            stationLayer
        )
    ) {

        map.removeLayer(
            stationLayer
        );

    } else {

        map.addLayer(
            stationLayer
        );

    }

}


/* ========================================================= */
/* KEEP MAP THEME IN SYNC                                    */
/* ========================================================= */

function refreshMapTheme() {

    applyMapTheme();

}


/* ========================================================= */
/* INITIAL MAP THEME                                         */
/* ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setTimeout(
            function () {

                applyMapTheme();

            },
            150
        );

    }
);