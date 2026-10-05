console.log("search.js loaded");


let searchController = null;


/* ================================================= */
/* SEARCH PLACES */
/* ================================================= */

async function searchPlaces(
    query,
    suggestionBox,
    inputBox
) {

    console.log(
        "Searching:",
        query
    );


    const cleanQuery =
        query.trim();


    if (
        cleanQuery.length < 3
    ) {

        suggestionBox.style.display =
            "none";

        return;

    }


    /* --------------------------------------------- */
    /* CANCEL PREVIOUS REQUEST */
    /* --------------------------------------------- */

    if (searchController) {

        searchController.abort();

    }


    searchController =
        new AbortController();


    try {

        /*
         * IMPORTANT:
         * No debounce and no artificial delay.
         *
         * ArcGIS autocomplete is called immediately.
         */

        const url =
            "/autocomplete?q=" +
            encodeURIComponent(
                cleanQuery
            );


        console.log(
            "Autocomplete URL:",
            url
        );


        const response =
            await fetch(
                url,
                {
                    signal:
                        searchController.signal
                }
            );


        if (!response.ok) {

            throw new Error(
                "Autocomplete HTTP error: " +
                response.status
            );

        }


        const data =
            await response.json();


        console.log(
            "Autocomplete results:",
            data
        );


        suggestionBox.innerHTML =
            "";


        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {

            suggestionBox.innerHTML =
                "<div class='suggestion'>" +
                "No locations found" +
                "</div>";

            suggestionBox.style.display =
                "block";

            return;

        }


        /* ----------------------------------------- */
        /* CREATE DROPDOWN */
        /* ----------------------------------------- */

        data.slice(
            0,
            5
        ).forEach(
            place => {

                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "suggestion";


                div.textContent =
                    "📍 " +
                    place.display_name;


                /* --------------------------------- */
                /* CLICK */
                /* --------------------------------- */

                div.addEventListener(
                    "click",
                    async function () {

                        inputBox.value =
                            place.display_name;


                        suggestionBox.style.display =
                            "none";


                        /*
                         * Resolve the selected
                         * suggestion only after
                         * the user clicks it.
                         *
                         * This does NOT slow down
                         * the dropdown.
                         */

                        try {

                            const resolveUrl =
                                "/geocode_resolve?q=" +
                                encodeURIComponent(
                                    place.display_name
                                ) +
                                "&magicKey=" +
                                encodeURIComponent(
                                    place.magicKey || ""
                                );


                            const response =
                                await fetch(
                                    resolveUrl
                                );


                            if (!response.ok) {

                                throw new Error(
                                    "Location resolve HTTP error: " +
                                    response.status
                                );

                            }


                            const resolved =
                                await response.json();


                            if (
                                !Array.isArray(
                                    resolved
                                ) ||
                                resolved.length === 0
                            ) {

                                return;

                            }


                            const selected =
                                resolved[0];


                            const lat =
                                parseFloat(
                                    selected.lat
                                );


                            const lon =
                                parseFloat(
                                    selected.lon
                                );


                            if (
                                !Number.isFinite(
                                    lat
                                ) ||
                                !Number.isFinite(
                                    lon
                                )
                            ) {

                                return;

                            }


                            console.log(
                                "Selected location:",
                                lat,
                                lon
                            );


                            /* --------------------- */
                            /* MOVE MAP */
                            /* --------------------- */

                            if (
                                typeof map !==
                                "undefined" &&
                                map
                            ) {

                                map.setView(
                                    [
                                        lat,
                                        lon
                                    ],
                                    15
                                );

                            }


                            /* --------------------- */
                            /* REMOVE OLD MARKER */
                            /* --------------------- */

                            if (
                                window.searchMarker &&
                                typeof map !==
                                "undefined" &&
                                map
                            ) {

                                map.removeLayer(
                                    window.searchMarker
                                );

                            }


                            /* --------------------- */
                            /* CREATE MARKER */
                            /* --------------------- */

                            if (
                                typeof map !==
                                "undefined" &&
                                map
                            ) {

                                window.searchMarker =
                                    L.marker(
                                        [
                                            lat,
                                            lon
                                        ]
                                    )
                                    .addTo(
                                        map
                                    )
                                    .bindPopup(
                                        "<b>" +
                                        "Selected Location" +
                                        "</b><br>" +
                                        selected.display_name
                                    )
                                    .openPopup();

                            }

                        }

                        catch (error) {

                            console.error(
                                "Location resolve error:",
                                error
                            );

                        }

                    }
                );


                suggestionBox.appendChild(
                    div
                );

            }
        );


        suggestionBox.style.display =
            "block";


    }

    catch (error) {

        /*
         * Ignore cancelled requests.
         */

        if (
            error.name ===
            "AbortError"
        ) {

            return;

        }


        console.error(
            "Location search error:",
            error
        );


        suggestionBox.innerHTML =
            "<div class='suggestion'>" +
            "Unable to search location" +
            "</div>";


        suggestionBox.style.display =
            "block";

    }

}


/* ================================================= */
/* SOURCE */
/* ================================================= */

const sourceInput =
    document.getElementById(
        "sourceInput"
    );


const sourceSuggestions =
    document.getElementById(
        "sourceSuggestions"
    );


console.log(
    "Source input:",
    sourceInput
);


console.log(
    "Source suggestions:",
    sourceSuggestions
);


if (
    sourceInput &&
    sourceSuggestions
) {

    sourceInput.addEventListener(
        "input",
        function () {

            searchPlaces(
                this.value,
                sourceSuggestions,
                sourceInput
            );

        }
    );


    console.log(
        "Source search listener attached"
    );

}


/* ================================================= */
/* DESTINATION */
/* ================================================= */

const destinationInput =
    document.getElementById(
        "destinationInput"
    );


const destinationSuggestions =
    document.getElementById(
        "destinationSuggestions"
    );


console.log(
    "Destination input:",
    destinationInput
);


console.log(
    "Destination suggestions:",
    destinationSuggestions
);


if (
    destinationInput &&
    destinationSuggestions
) {

    destinationInput.addEventListener(
        "input",
        function () {

            searchPlaces(
                this.value,
                destinationSuggestions,
                destinationInput
            );

        }
    );


    console.log(
        "Destination search listener attached"
    );

}
``` :chatgpt-content-reference{index="0"}
