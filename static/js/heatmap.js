/* ---------------------- */
/* Heatmap */
/* ---------------------- */

let heatLayer = null;

let heatmapVisible = true;


/* ---------------------- */
/* DRAW HEATMAP */
/* ---------------------- */

function drawHeatmap(url) {

    fetch(url)

        .then(response => response.json())

        .then(data => {

            let heatData = [];

            data.forEach(point => {

                heatData.push([
                    point[0],
                    point[1],
                    point[2] / 250
                ]);

            });


            /* Remove old heatmap */

            if (heatLayer) {

                map.removeLayer(heatLayer);

            }


            /* Create new heatmap */

            heatLayer = L.heatLayer(

                heatData,

                {
                    radius: 25,
                    blur: 20,
                    maxZoom: 15
                }

            );


            /*
             * Only add the heatmap if it is
             * currently enabled.
             */

            if (heatmapVisible) {

                heatLayer.addTo(map);

            }

        })

        .catch(error => {

            console.error(
                "Heatmap loading error:",
                error
            );

        });

}


/* ---------------------- */
/* LOAD CURRENT HEATMAP */
/* ---------------------- */

function loadCurrentHeatmap() {

    console.log(
        "Loading Current Heatmap"
    );

    drawHeatmap(
        '/heatmap'
    );

}


/* ---------------------- */
/* TOGGLE HEATMAP */
/* ---------------------- */

function toggleHeatmap() {

    const checkbox =
        document.getElementById(
            "heatLayerChk"
        );


    if (!checkbox) {

        return;

    }


    /*
     * Make the internal state match
     * the checkbox.
     */

    heatmapVisible =
        checkbox.checked;


    if (heatmapVisible) {

        /*
         * If heatmap doesn't exist yet,
         * load it from the server.
         */

        if (!heatLayer) {

            loadCurrentHeatmap();

        }

        else {

            /*
             * Heatmap already exists,
             * simply show it.
             */

            if (!map.hasLayer(heatLayer)) {

                heatLayer.addTo(map);

            }

        }

    }

    else {

        /*
         * Checkbox is unchecked,
         * so remove the heatmap.
         */

        if (heatLayer) {

            map.removeLayer(
                heatLayer
            );

        }

    }

}