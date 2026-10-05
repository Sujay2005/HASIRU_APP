console.log("search.js loaded");


let searchTimer = null;

let searchRequestId = 0;


// ============================================================
// SEARCH PLACES
// ============================================================

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

        suggestionBox.innerHTML = "";

        suggestionBox.style.display =
            "none";

        return;

    }


    const requestId =
        ++searchRequestId;


    try {

        /*
         * Flask acts as the geocoding proxy.
         */

        const url =
            "/geocode?q=" +
            encodeURIComponent(
                cleanQuery
            );


        console.log(
            "Geocode URL:",
            url
        );


        const response =
            await fetch(url);


        /*
         * Ignore older requests.
         */

        if (
            requestId !==
            searchRequestId
        ) {

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Geocoding HTTP error: " +
                response.status
            );

        }


        const data =
            await response.json();


        console.log(
            "Geocoding results:",
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


                div.addEventListener(
                    "click",
                    function () {

                        inputBox.value =
                            place.display_name;


                        suggestionBox.style.display =
                            "none";


                        const lat =
                            parseFloat(
                                place.lat
                            );


                        const lon =
                            parseFloat(
                                place.lon
                            );


                        console.log(
                            "Selected location:",
                            lat,
                            lon
                        );


                        /*
                         * Move Leaflet map
                         */

                        if (
                            typeof map !==
                            "undefined"
                        ) {

                            map.setView(
                                [
                                    lat,
                                    lon
                                ],
                                15
                            );

                        }


                        /*
                         * Remove previous
                         * search marker
                         */

                        if (
                            window.searchMarker
                        ) {

                            map.removeLayer(
                                window.searchMarker
                            );

                        }


                        /*
                         * Create new marker
                         */

                        window.searchMarker =
                            L.marker(
                                [
                                    lat,
                                    lon
                                ]
                            )
                            .addTo(map)
                            .bindPopup(
                                "<b>" +
                                "Selected Location" +
                                "</b><br>" +
                                place.display_name
                            )
                            .openPopup();

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

        if (
            requestId !==
            searchRequestId
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


// ============================================================
// DEBOUNCED SEARCH
// ============================================================

function scheduleSearch(
    inputBox,
    suggestionBox
) {

    clearTimeout(
        searchTimer
    );


    searchTimer =
        setTimeout(
            function () {

                searchPlaces(
                    inputBox.value,
                    suggestionBox,
                    inputBox
                );

            },
            700
        );

}


// ============================================================
// SOURCE
// ============================================================

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

            scheduleSearch(
                sourceInput,
                sourceSuggestions
            );

        }
    );


    console.log(
        "Source search listener attached"
    );

}


// ============================================================
// DESTINATION
// ============================================================

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

            scheduleSearch(
                destinationInput,
                destinationSuggestions
            );

        }
    );


    console.log(
        "Destination search listener attached"
    );

}
