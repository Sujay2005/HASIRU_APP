console.log("search.js loaded");


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

    query = query.trim();

    if (query.length < 2) {

        suggestionBox.innerHTML = "";

        suggestionBox.style.display =
            "none";

        return;
    }

    try {

        const url =
            "/autocomplete?q=" +
            encodeURIComponent(query);

        console.log(
            "Autocomplete URL:",
            url
        );

        const response =
            await fetch(url);

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

        suggestionBox.innerHTML = "";


        // ====================================================
        // NO RESULTS
        // ====================================================

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


        // ====================================================
        // DISPLAY RESULTS
        // ====================================================

        data
            .slice(0, 5)
            .forEach(place => {

                const div =
                    document.createElement(
                        "div"
                    );

                // Keep your existing dropdown class.
                div.className =
                    "suggestion";

                div.textContent =
                    "📍 " +
                    place.display_name;


                // =================================================
                // CLICK RESULT
                // =================================================

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


                        if (
                            !Number.isFinite(lat) ||
                            !Number.isFinite(lon)
                        ) {

                            console.error(
                                "Invalid coordinates:",
                                place
                            );

                            return;
                        }


                        // =============================================
                        // MOVE MAP
                        // =============================================

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


                            // =========================================
                            // REMOVE OLD SEARCH MARKER
                            // =========================================

                            if (
                                window.searchMarker
                            ) {

                                map.removeLayer(
                                    window.searchMarker
                                );
                            }


                            // =========================================
                            // ADD NEW SEARCH MARKER
                            // =========================================

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
                    }
                );


                suggestionBox.appendChild(
                    div
                );
            });


        suggestionBox.style.display =
            "block";


    }
    catch (error) {

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
// SOURCE INPUT
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


// ============================================================
// DESTINATION INPUT
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


// ============================================================
// CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
// ============================================================

document.addEventListener(
    "click",
    function (event) {

        if (
            sourceInput &&
            sourceSuggestions &&
            !sourceInput.contains(event.target) &&
            !sourceSuggestions.contains(event.target)
        ) {

            sourceSuggestions.style.display =
                "none";
        }


        if (
            destinationInput &&
            destinationSuggestions &&
            !destinationInput.contains(event.target) &&
            !destinationSuggestions.contains(event.target)
        ) {

            destinationSuggestions.style.display =
                "none";
        }

    }
);
