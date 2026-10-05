/* =========================================================
   routing.js — FULL CORRECTED VERSION
   TOUCH / PINCH FIX
   ========================================================= */


/* =========================================================
   ROUTING STATE
========================================================= */

let userSelectedRoute = false;
let recommendedIndex = -1;
let fastestIndex = -1;
let selectedRoute = 0;

let source = null;
let destination = null;

let sourceMarker = null;
let destinationMarker = null;

let routeSegmentsLayer =
    L.layerGroup().addTo(map);

let alternateRoutesLayer =
    L.layerGroup().addTo(map);

let routePolylines = [];
let routeResults = [];
let routeSummaryMinimized = false;


/* =========================================================
   LIVE NAVIGATION
========================================================= */

let navigationActive = false;
let navigationWatchId = null;
let navigationMarker = null;
let navigationRoutePolyline = null;
let navigationRouteCoords = null;

let lastNavigationRerouteTime = 0;
let lastKnownNavigationPosition = null;

let navigationFollowMode = false;
let navigationFullRouteCoords = null;

const NAVIGATION_OFF_ROUTE_DISTANCE = 50;
const NAVIGATION_DESTINATION_DISTANCE = 30;
const NAVIGATION_REROUTE_COOLDOWN = 5000;


/* =========================================================
   DISTANCE
========================================================= */

function getDistanceMeters(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R = 6371000;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *

        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    return R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );
}


/* =========================================================
   DISTANCE POINT TO SEGMENT
========================================================= */

function distancePointToSegmentMeters(
    point,
    a,
    b
) {

    const latScale = 111320;

    const lngScale =
        111320 *
        Math.cos(
            point.lat *
            Math.PI /
            180
        );

    const px = point.lng * lngScale;
    const py = point.lat * latScale;

    const ax = a[1] * lngScale;
    const ay = a[0] * latScale;

    const bx = b[1] * lngScale;
    const by = b[0] * latScale;

    const dx = bx - ax;
    const dy = by - ay;

    if (
        dx === 0 &&
        dy === 0
    ) {

        return Math.hypot(
            px - ax,
            py - ay
        );
    }

    let t =
        (
            (px - ax) * dx +
            (py - ay) * dy
        ) /
        (
            dx * dx +
            dy * dy
        );

    t =
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );

    return Math.hypot(
        px - (ax + t * dx),
        py - (ay + t * dy)
    );
}


/* =========================================================
   DISTANCE TO ROUTE
========================================================= */

function distanceToRouteMeters(
    position,
    coords
) {

    if (
        !coords ||
        coords.length < 2
    ) {

        return Infinity;
    }

    let minimum = Infinity;

    for (
        let i = 0;
        i < coords.length - 1;
        i++
    ) {

        minimum =
            Math.min(
                minimum,
                distancePointToSegmentMeters(
                    position,
                    coords[i],
                    coords[i + 1]
                )
            );
    }

    return minimum;
}


/* =========================================================
   NAVIGATION MARKER
========================================================= */

function createNavigationMarker(
    position
) {

    if (navigationMarker) {

        navigationMarker.setLatLng([
            position.lat,
            position.lng
        ]);

        return;
    }

    navigationMarker =
        L.circleMarker(
            [
                position.lat,
                position.lng
            ],
            {
                radius: 9,
                color: "#ffffff",
                weight: 3,
                fillColor: "#1976e8",
                fillOpacity: 1
            }
        ).addTo(map);
}


/* =========================================================
   DRAW NAVIGATION ROUTE
========================================================= */

function drawNavigationRoute(
    coords
) {

    if (
        !coords ||
        coords.length < 2
    ) {

        return;
    }

    navigationFullRouteCoords =
        coords.slice();

    navigationRouteCoords =
        coords.slice();

    if (navigationRoutePolyline) {

        map.removeLayer(
            navigationRoutePolyline
        );
    }

    navigationRoutePolyline =
        L.polyline(
            coords,
            {
                color: "#1976e8",
                weight: 7,
                opacity: 0.95
            }
        ).addTo(map);
}


/* =========================================================
   REMOVE ALREADY TRAVELLED ROUTE
========================================================= */

function trimNavigationRoute(
    currentPosition
) {

    if (
        !navigationActive ||
        !navigationFullRouteCoords ||
        navigationFullRouteCoords.length < 2 ||
        !navigationRoutePolyline
    ) {

        return;
    }

    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (
        let i = 0;
        i < navigationFullRouteCoords.length;
        i++
    ) {

        const point =
            navigationFullRouteCoords[i];

        const distance =
            getDistanceMeters(
                currentPosition.lat,
                currentPosition.lng,
                point[0],
                point[1]
            );

        if (
            distance <
            nearestDistance
        ) {

            nearestDistance = distance;
            nearestIndex = i;
        }
    }

    const remainingRoute = [
        [
            currentPosition.lat,
            currentPosition.lng
        ]
    ];

    for (
        let i = nearestIndex + 1;
        i < navigationFullRouteCoords.length;
        i++
    ) {

        remainingRoute.push(
            navigationFullRouteCoords[i]
        );
    }

    if (
        remainingRoute.length < 2 &&
        destination
    ) {

        remainingRoute.push([
            destination.lat,
            destination.lng
        ]);
    }

    navigationRouteCoords =
        remainingRoute;

    navigationRoutePolyline.setLatLngs(
        remainingRoute
    );
}


/* =========================================================
   REROUTE
========================================================= */

async function rerouteNavigation(
    position
) {

    if (
        !navigationActive ||
        !destination
    ) {

        return;
    }

    const now = Date.now();

    if (
        now -
        lastNavigationRerouteTime <
        NAVIGATION_REROUTE_COOLDOWN
    ) {

        return;
    }

    lastNavigationRerouteTime = now;

    try {

        const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${position.lng},${position.lat};` +
            `${destination.lng},${destination.lat}` +
            "?overview=full&geometries=geojson";

        const response =
            await fetch(url);

        if (!response.ok) {

            return;
        }

        const data =
            await response.json();

        if (
            !data.routes ||
            !data.routes.length
        ) {

            return;
        }

        const coords =
            data.routes[0]
                .geometry
                .coordinates
                .map(
                    function (c) {

                        return [
                            c[1],
                            c[0]
                        ];
                    }
                );

        drawNavigationRoute(
            coords
        );

        source = {
            lat: position.lat,
            lng: position.lng
        };

    } catch (error) {

        console.error(
            "Navigation reroute failed:",
            error
        );
    }
}


/* =========================================================
   CONTINUOUS GPS
========================================================= */

function updateNavigationPosition(
    position
) {

    if (!navigationActive) {

        return;
    }

    const currentPosition = {

        lat:
            position.coords.latitude,

        lng:
            position.coords.longitude
    };

    lastKnownNavigationPosition =
        currentPosition;

    source =
        currentPosition;

    createNavigationMarker(
        currentPosition
    );

    if (
        navigationFollowMode
    ) {

        map.setView(
            [
                currentPosition.lat,
                currentPosition.lng
            ],
            Math.max(
                map.getZoom(),
                17
            ),
            {
                animate: true
            }
        );
    }

    trimNavigationRoute(
        currentPosition
    );

    if (!destination) {

        return;
    }

    const distanceToDestination =
        getDistanceMeters(
            currentPosition.lat,
            currentPosition.lng,
            destination.lat,
            destination.lng
        );

    if (
        distanceToDestination <=
        NAVIGATION_DESTINATION_DISTANCE
    ) {

        stopNavigation(true);

        return;
    }

    if (
        navigationRouteCoords &&
        navigationRouteCoords.length > 1
    ) {

        const routeDistance =
            distanceToRouteMeters(
                currentPosition,
                navigationRouteCoords
            );

        if (
            routeDistance >
            NAVIGATION_OFF_ROUTE_DISTANCE
        ) {

            rerouteNavigation(
                currentPosition
            );
        }
    }
}


/* =========================================================
   START NAVIGATION
========================================================= */

function startNavigation() {

    if (
        navigationActive ||
        !source ||
        !destination ||
        !routeResults[selectedRoute]
    ) {

        return;
    }

    navigationActive = true;

    navigationFollowMode = true;

    lastNavigationRerouteTime = 0;

    if (sourceMarker) {

        sourceMarker.setOpacity(0);
    }

    navigationRouteCoords =
        routeResults[
            selectedRoute
        ].routeCoords || null;

    if (navigationRouteCoords) {

        drawNavigationRoute(
            navigationRouteCoords
        );
    }

    lastKnownNavigationPosition = {

        lat: source.lat,
        lng: source.lng
    };

    createNavigationMarker(
        lastKnownNavigationPosition
    );

    if (
        navigationWatchId !== null
    ) {

        navigator.geolocation.clearWatch(
            navigationWatchId
        );
    }

    navigationWatchId =
        navigator.geolocation.watchPosition(

            updateNavigationPosition,

            function (error) {

                console.warn(
                    "Navigation GPS error:",
                    error
                );
            },

            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 10000
            }
        );
}


/* =========================================================
   STOP NAVIGATION
========================================================= */

function stopNavigation(
    reachedDestination
) {

    navigationActive = false;

    navigationFollowMode = false;

    navigationFullRouteCoords = null;

    if (
        navigationWatchId !== null
    ) {

        navigator.geolocation.clearWatch(
            navigationWatchId
        );

        navigationWatchId = null;
    }

    if (navigationMarker) {

        map.removeLayer(
            navigationMarker
        );

        navigationMarker = null;
    }

    if (navigationRoutePolyline) {

        map.removeLayer(
            navigationRoutePolyline
        );

        navigationRoutePolyline = null;
    }

    navigationRouteCoords = null;

    lastKnownNavigationPosition = null;

    if (sourceMarker) {

        sourceMarker.setOpacity(1);
    }

    if (reachedDestination) {

        alert(
            "You have reached your destination."
        );
    }
}


/* =========================================================
   RE-CENTER
========================================================= */

function recenterMap() {

    if (navigationActive) {

        navigationFollowMode = true;
    }

    let target = null;

    if (navigationMarker) {

        target =
            navigationMarker.getLatLng();

    } else if (
        lastKnownNavigationPosition
    ) {

        target =
            lastKnownNavigationPosition;

    } else if (source) {

        target = source;
    }

    if (target) {

        map.setView(
            [
                target.lat,
                target.lng
            ],
            Math.max(
                map.getZoom(),
                17
            ),
            {
                animate: true
            }
        );
    }

    if (!navigator.geolocation) {

        return;
    }

    navigator.geolocation.getCurrentPosition(

        function (position) {

            const current = {

                lat:
                    position.coords.latitude,

                lng:
                    position.coords.longitude
            };

            source = current;

            lastKnownNavigationPosition =
                current;

            createNavigationMarker(
                current
            );

            if (sourceMarker) {

                sourceMarker.setLatLng([
                    current.lat,
                    current.lng
                ]);
            }

            map.setView(
                [
                    current.lat,
                    current.lng
                ],
                Math.max(
                    map.getZoom(),
                    17
                ),
                {
                    animate: true
                }
            );
        },

        function (error) {

            console.warn(
                "Re-center GPS error:",
                error
            );
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000
        }
    );
}


/* =========================================================
   RE-CENTER BUTTON
========================================================= */

function createRecenterButton() {

    if (
        document.getElementById(
            "recenterMapBtn"
        )
    ) {

        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "recenterMapBtn";

    button.type =
        "button";

    button.innerHTML =
        "◉&nbsp; Re-center";

    button.title =
        "Center map on my current location";

    button.style.cssText = `
        position:fixed;
        top:125px;
        right:14px;
        z-index:4500;
        height:38px;
        padding:0 14px;
        border:1px solid rgba(59,130,246,.55);
        border-radius:20px;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        touch-action:manipulation;
    `;

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            recenterMap();
        }
    );

    document.body.appendChild(
        button
    );
}


/* =========================================================
   POSITION RE-CENTER BUTTON
========================================================= */

function setupLayersRecenterPosition() {

    const recenterButton =
        document.getElementById(
            "recenterMapBtn"
        );

    if (!recenterButton) {

        return;
    }

    const layersControl =
        document.querySelector(
            ".leaflet-control-layers"
        );

    if (!layersControl) {

        return;
    }

    function updateRecenterPosition() {

        const rect =
            layersControl.getBoundingClientRect();

        if (!rect) {

            return;
        }

        recenterButton.style.top =
            (
                rect.bottom + 10
            ) + "px";
    }

    updateRecenterPosition();

    window.addEventListener(
        "resize",
        updateRecenterPosition
    );
}


/* =========================================================
   INITIALIZE RE-CENTER
========================================================= */

function initializeRecenterButton() {

    createRecenterButton();

    setTimeout(
        setupLayersRecenterPosition,
        300
    );
}

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeRecenterButton
    );

} else {

    initializeRecenterButton();
}

window.recenterMap =
    recenterMap;


/* =========================================================
   AQI
========================================================= */

function getAQIColor(aqi) {

    aqi = Number(aqi);

    if (!Number.isFinite(aqi)) {

        aqi = 0;
    }

    if (aqi <= 50)
        return "#00e400";

    if (aqi <= 100)
        return "#ffff00";

    if (aqi <= 200)
        return "#ff7e00";

    if (aqi <= 300)
        return "#ff0000";

    if (aqi <= 400)
        return "#8f3f97";

    return "#7e0023";
}


function getAQICategory(aqi) {

    aqi = Number(aqi);

    if (!Number.isFinite(aqi)) {

        aqi = 0;
    }

    if (aqi <= 50)
        return "Good";

    if (aqi <= 100)
        return "Satisfactory";

    if (aqi <= 200)
        return "Moderate";

    if (aqi <= 300)
        return "Poor";

    if (aqi <= 400)
        return "Very Poor";

    return "Severe";
}


/* =========================================================
   ROUTE SELECTION
========================================================= */

function selectRoute(index) {

    if (
        !routePolylines[index] ||
        !routeResults[index]
    ) {

        return;
    }

    userSelectedRoute = true;

    selectedRoute = index;

    routePolylines.forEach(
        function (polyline, i) {

            if (i === index) {

                if (
                    !alternateRoutesLayer.hasLayer(
                        polyline
                    )
                ) {

                    polyline.addTo(
                        alternateRoutesLayer
                    );
                }

                polyline.setStyle({

                    weight: 10,
                    opacity: 1
                });

            } else {

                if (
                    alternateRoutesLayer.hasLayer(
                        polyline
                    )
                ) {

                    alternateRoutesLayer.removeLayer(
                        polyline
                    );
                }
            }
        }
    );

    renderRouteCards();

    showRouteSummary(index);

    loadRouteSegments(index);

    if (
        navigationActive &&
        routeResults[index].routeCoords
    ) {

        drawNavigationRoute(
            routeResults[index].routeCoords
        );
    }

    if (
        typeof map !== "undefined" &&
        map &&
        !navigationActive
    ) {

        map.fitBounds(
            routePolylines[index].getBounds(),
            {
                padding: [
                    30,
                    30
                ]
            }
        );
    }
}


/* =========================================================
   DRAW ROUTE
========================================================= */

async function drawRoute() {

    if (
        !source ||
        !destination
    ) {

        return;
    }

    const loadingOverlay =
        document.getElementById(
            "loadingOverlay"
        );

    if (loadingOverlay) {

        loadingOverlay.style.display =
            "flex";
    }

    try {

        const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${source.lng},${source.lat};` +
            `${destination.lng},${destination.lat}` +
            "?overview=full&geometries=geojson&alternatives=true";

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                "OSRM request failed: HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        if (
            !data.routes ||
            data.routes.length === 0
        ) {

            alert(
                "No route found"
            );

            return;
        }

        const routes =
            data.routes;

        routeResults = [];
        routePolylines = [];

        recommendedIndex = -1;
        fastestIndex = -1;
        selectedRoute = 0;
        userSelectedRoute = false;

        alternateRoutesLayer.clearLayers();

        routeSegmentsLayer.clearLayers();

        const routeColors = [
            "blue",
            "green",
            "purple"
        ];

        routes.forEach(
            function (route, index) {

                const routeLatLngs =
                    route.geometry.coordinates.map(
                        function (coordinate) {

                            return [
                                coordinate[1],
                                coordinate[0]
                            ];
                        }
                    );

                const polyline =
                    L.polyline(
                        routeLatLngs,
                        {
                            color:
                                routeColors[
                                    index %
                                    routeColors.length
                                ],

                            weight: 5,
                            opacity: 0.7
                        }
                    );

                polyline.addTo(
                    alternateRoutesLayer
                );

                routePolylines.push(
                    polyline
                );

                polyline.on(
                    "click",
                    function () {

                        selectRoute(index);
                    }
                );
            }
        );


        const routePromises =
            routes.map(
                async function (
                    route,
                    index
                ) {

                    const routeCoords =
                        route.geometry.coordinates.map(
                            function (coordinate) {

                                return [
                                    coordinate[1],
                                    coordinate[0]
                                ];
                            }
                        );

                    const mins =
                        (
                            route.duration /
                            60
                        ).toFixed(1);

                    let aqiData = {

                        average_aqi: 0,
                        max_aqi: 0,
                        exposure_score: 0,
                        category: "Unknown"
                    };

                    let futureAQI = {

                        average_aqi: null
                    };


                    try {

                        const response =
                            await fetch(
                                "/route_aqi",
                                {
                                    method:
                                        "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            route:
                                                routeCoords,

                                            travel_time:
                                                parseFloat(
                                                    mins
                                                )
                                        })
                                }
                            );

                        if (response.ok) {

                            const result =
                                await response.json();

                            if (result) {

                                aqiData =
                                    result;
                            }
                        }

                    } catch (error) {

                        console.warn(
                            "Current AQI unavailable:",
                            error
                        );
                    }


                    try {

                        const response =
                            await fetch(
                                "/future_route_aqi",
                                {
                                    method:
                                        "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },

                                    body:
                                        JSON.stringify({

                                            route:
                                                routeCoords,

                                            travel_time:
                                                parseFloat(
                                                    mins
                                                )
                                        })
                                }
                            );

                        if (response.ok) {

                            const result =
                                await response.json();

                            if (result) {

                                futureAQI =
                                    result;
                            }
                        }

                    } catch (error) {

                        console.warn(
                            "Future AQI unavailable:",
                            error
                        );
                    }


                    const averageAQI =
                        Number(
                            aqiData.average_aqi
                        );

                    const maxAQI =
                        Number(
                            aqiData.max_aqi
                        );

                    const exposure =
                        Number(
                            aqiData.exposure_score
                        );

                    return {

                        routeNumber:
                            index + 1,

                        distance:
                            (
                                route.distance /
                                1000
                            ).toFixed(2),

                        time:
                            mins,

                        averageAQI:
                            Number.isFinite(
                                averageAQI
                            )
                                ?
                                averageAQI
                                :
                                0,

                        maxAQI:
                            Number.isFinite(
                                maxAQI
                            )
                                ?
                                maxAQI
                                :
                                0,

                        exposure:
                            Number.isFinite(
                                exposure
                            )
                                ?
                                exposure
                                :
                                0,

                        category:
                            aqiData.category ||
                            getAQICategory(
                                averageAQI
                            ),

                        futureAQI:
                            futureAQI,

                        routeCoords:
                            routeCoords,

                        originalRoute:
                            route
                    };
                }
            );


        routeResults =
            await Promise.all(
                routePromises
            );


        if (
            routeResults.length > 0
        ) {

            recommendedIndex = 0;

            fastestIndex = 0;

            routeResults.forEach(
                function (
                    route,
                    index
                ) {

                    if (
                        route.exposure <
                        routeResults[
                            recommendedIndex
                        ].exposure
                    ) {

                        recommendedIndex =
                            index;
                    }

                    if (
                        parseFloat(
                            route.time
                        ) <
                        parseFloat(
                            routeResults[
                                fastestIndex
                            ].time
                        )
                    ) {

                        fastestIndex =
                            index;
                    }
                }
            );
        }


        renderRouteCards();


        if (
            recommendedIndex >= 0 &&
            routePolylines[
                recommendedIndex
            ]
        ) {

            selectedRoute =
                recommendedIndex;

            routePolylines[
                recommendedIndex
            ].setStyle({

                weight: 10,
                opacity: 1
            });

            showRouteSummary(
                recommendedIndex
            );

            loadRouteSegments(
                recommendedIndex
            );
        }


        if (
            routePolylines.length > 0
        ) {

            const bounds =
                L.featureGroup(
                    routePolylines
                ).getBounds();

            if (bounds.isValid()) {

                map.fitBounds(
                    bounds,
                    {
                        padding: [
                            30,
                            30
                        ]
                    }
                );
            }
        }

    } catch (error) {

        console.error(
            "Route request failed:",
            error
        );

        alert(
            "Route request failed"
        );

    } finally {

        if (loadingOverlay) {

            loadingOverlay.style.display =
                "none";
        }
    }
}


/* =========================================================
   ROUTE SEGMENTS
========================================================= */

async function loadRouteSegments(
    index
) {

    if (
        !routeResults[index]
    ) {

        return;
    }

    const route =
        routeResults[index];

    const routeCoords =
        route.routeCoords;

    if (
        !routeCoords ||
        routeCoords.length < 2
    ) {

        return;
    }

    try {

        const response =
            await fetch(
                "/route_segments",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            route:
                                routeCoords
                        })
                }
            );

        if (!response.ok) {

            return;
        }

        const segmentData =
            await response.json();

        if (
            !Array.isArray(
                segmentData
            ) ||
            segmentData.length < 2
        ) {

            return;
        }

        if (
            index !== selectedRoute
        ) {

            return;
        }

        routeSegmentsLayer.clearLayers();

        for (
            let i = 0;
            i < segmentData.length - 1;
            i++
        ) {

            const p1 =
                segmentData[i];

            const p2 =
                segmentData[i + 1];

            const segment =
                L.polyline(
                    [
                        [
                            p1.lat,
                            p1.lon
                        ],
                        [
                            p2.lat,
                            p2.lon
                        ]
                    ],
                    {
                        color:
                            getAQIColor(
                                p1.aqi
                            ),

                        weight: 8,
                        opacity: 1
                    }
                );

            segment.bindPopup(
                "<b>Segment AQI</b><br>" +
                "AQI: " +
                Math.round(
                    Number(p1.aqi)
                )
            );

            routeSegmentsLayer.addLayer(
                segment
            );
        }

    } catch (error) {

        console.error(
            "Route segment error:",
            error
        );
    }
}


/* =========================================================
   GEOCODING
========================================================= */

async function geocode(
    place
) {

    const normalizedPlace =
        String(
            place || ""
        )
        .trim()
        .toLowerCase();


    /*
       RNS HARD-CODED LOCATION
    */

    if (
        normalizedPlace.includes(
            "rns institute of technology"
        ) ||
        normalizedPlace.includes(
            "rnsit"
        ) ||
        normalizedPlace === "rns"
    ) {

        return {

            lat: 12.900733,
            lng: 77.518175
        };
    }


    const url =
        "/geocode?q=" +
        encodeURIComponent(
            place
        );

    const response =
        await fetch(
            url
        );

    if (!response.ok) {

        throw new Error(
            "Geocoding failed: HTTP " +
            response.status
        );
    }

    const data =
        await response.json();

    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        throw new Error(
            "Location not found"
        );
    }

    const lat =
        parseFloat(
            data[0].lat
        );

    const lng =
        parseFloat(
            data[0].lon
        );

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        throw new Error(
            "Invalid coordinates"
        );
    }

    return {

        lat: lat,
        lng: lng
    };
}


/* =========================================================
   FIND ROUTE
========================================================= */

async function findRoute() {

    try {

        userSelectedRoute = false;

        recommendedIndex = -1;
        fastestIndex = -1;
        selectedRoute = 0;

        const sourceInput =
            document.getElementById(
                "sourceInput"
            );

        const destinationInput =
            document.getElementById(
                "destinationInput"
            );

        if (
            !sourceInput ||
            !destinationInput
        ) {

            return;
        }

        const destinationText =
            destinationInput.value.trim();

        if (!destinationText) {

            alert(
                "Enter destination"
            );

            return;
        }

        const loadingOverlay =
            document.getElementById(
                "loadingOverlay"
            );

        if (loadingOverlay) {

            loadingOverlay.style.display =
                "flex";
        }

        const position =
            await new Promise(
                function (
                    resolve,
                    reject
                ) {

                    if (
                        !navigator.geolocation
                    ) {

                        reject(
                            new Error(
                                "Geolocation is not supported"
                            )
                        );

                        return;
                    }

                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        reject,
                        {
                            enableHighAccuracy:
                                true,

                            timeout:
                                15000,

                            maximumAge:
                                0
                        }
                    );
                }
            );


        source = {

            lat:
                position.coords.latitude,

            lng:
                position.coords.longitude
        };


        destination =
            await geocode(
                destinationText
            );


        if (sourceMarker) {

            map.removeLayer(
                sourceMarker
            );

            sourceMarker = null;
        }

        if (destinationMarker) {

            map.removeLayer(
                destinationMarker
            );

            destinationMarker = null;
        }


        sourceMarker =
            L.marker(
                source
            )
            .addTo(map)
            .bindPopup(
                "Source"
            );


        destinationMarker =
            L.marker(
                destination
            )
            .addTo(map)
            .bindPopup(
                "Destination"
            );


        await drawRoute();

    } catch (error) {

        console.error(
            "Find route error:",
            error
        );

        const loadingOverlay =
            document.getElementById(
                "loadingOverlay"
            );

        if (loadingOverlay) {

            loadingOverlay.style.display =
                "none";
        }

        if (
            error &&
            error.code === 1
        ) {

            alert(
                "Please allow location access to get your current location"
            );

        } else if (
            error &&
            error.code === 2
        ) {

            alert(
                "Unable to get your current location"
            );

        } else if (
            error &&
            error.code === 3
        ) {

            alert(
                "Location request timed out"
            );

        } else {

            alert(
                "Location not found"
            );
        }
    }
}


/* =========================================================
   CLEAR ROUTE
========================================================= */

function clearRoute() {

    stopNavigation(false);

    if (sourceMarker) {

        map.removeLayer(
            sourceMarker
        );

        sourceMarker = null;
    }

    if (destinationMarker) {

        map.removeLayer(
            destinationMarker
        );

        destinationMarker = null;
    }

    alternateRoutesLayer.clearLayers();

    routeSegmentsLayer.clearLayers();

    source = null;
    destination = null;

    routeResults = [];

    routePolylines = [];

    userSelectedRoute = false;

    recommendedIndex = -1;
    fastestIndex = -1;
    selectedRoute = 0;

    const routeInfo =
        document.getElementById(
            "routeInfo"
        );

    if (routeInfo) {

        routeInfo.innerHTML =
            "Enter source and destination";
    }

    const routeSummary =
        document.getElementById(
            "routeSummary"
        );

    if (routeSummary) {

        routeSummary.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    routeSummaryMinimized = false;

    const restoreButton =
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if (restoreButton) {

        restoreButton.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    const detailsModal =
        document.getElementById(
            "detailsModal"
        );

    if (detailsModal) {

        detailsModal.style.display =
            "none";
    }
}


/* =========================================================
   HEALTH ADVICE
========================================================= */

function getHealthAdvice(
    category
) {

    switch (category) {

        case "Good":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Air quality is excellent. " +
                "Safe for everyone."
            );

        case "Satisfactory":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Air quality is acceptable. " +
                "Normal outdoor activities."
            );

        case "Moderate":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Sensitive groups should reduce " +
                "prolonged outdoor activity. " +
                "N95 mask recommended."
            );

        case "Poor":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Reduce outdoor exposure. " +
                "N95 mask recommended."
            );

        case "Very Poor":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Avoid outdoor exercise. " +
                "Stay indoors whenever possible."
            );

        case "Severe":

            return (
                "<hr>" +
                "<b>Health Advisory</b><br>" +
                "Hazardous air quality. " +
                "Avoid going outdoors."
            );

        default:

            return "";
    }
}


/* =========================================================
   ROUTE CARDS
========================================================= */

function renderRouteCards() {

    const routeInfo =
        document.getElementById(
            "routeInfo"
        );

    if (!routeInfo) {

        return;
    }

    let html = "";

    routeResults.forEach(
        function (
            route,
            index
        ) {

            let badge =
                "Alternative Route";

            let badgeColor =
                "#757575";

            if (
                index ===
                recommendedIndex
            ) {

                badge =
                    "Recommended";

                badgeColor =
                    "#2E7D32";

            } else if (
                index ===
                fastestIndex
            ) {

                badge =
                    "Fastest";

                badgeColor =
                    "#1565C0";
            }

            const aqiValue =
                Number(
                    route.averageAQI
                );

            const safeAQI =
                Number.isFinite(
                    aqiValue
                )
                    ?
                    aqiValue
                    :
                    0;

            const aqiColor =
                getAQIColor(
                    safeAQI
                );

            const aqiText =
                getAQICategory(
                    safeAQI
                );

            const isActive =
                selectedRoute ===
                index;

            html += `

<div
class="routeOption ${
    isActive
        ? "activeRoute"
        : ""
}"
onclick="selectRoute(${index})"
style="cursor:pointer;"
>

<div
class="routeBadge"
style="
background:${badgeColor};
"
>
${badge}
</div>

<div
class="aqiBadge"
style="
background:${aqiColor};
"
>
AQI
${Math.round(safeAQI)}
</div>

<div class="aqiText">
${aqiText}
</div>

<div class="routeMeta">
${route.distance} km
&nbsp;&nbsp;
${route.time} mins
</div>

<div class="routeExposure">
Exposure
${Math.round(
    Number(route.exposure) || 0
)}
</div>

</div>

`;
        }
    );

    routeInfo.innerHTML =
        html;
}


/* =========================================================
   MODAL CLOSE
========================================================= */

window.addEventListener(
    "click",
    function (event) {

        const modal =
            document.getElementById(
                "detailsModal"
            );

        if (
            modal &&
            event.target === modal
        ) {

            modal.style.display =
                "none";
        }
    }
);


/* =========================================================
   ROUTE SUMMARY STYLES
========================================================= */

function injectRouteSummaryStyles() {

    if (
        document.getElementById(
            "routeSummaryProfessionalStyles"
        )
    ) {

        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "routeSummaryProfessionalStyles";

    style.textContent = `

#routeSummary{

position:fixed!important;

left:18px!important;

right:auto!important;

bottom:18px!important;

width:350px!important;

max-width:calc(100vw - 36px);

box-sizing:border-box;

z-index:4000!important;

background:rgba(15,23,42,.94)!important;

border:1px solid rgba(148,163,184,.18)!important;

border-radius:18px!important;

box-shadow:0 18px 45px rgba(0,0,0,.34)!important;

backdrop-filter:blur(14px);

-webkit-backdrop-filter:blur(14px);

color:#f8fafc;

}

#routeSummary h3{

margin:0!important;

padding:17px 52px 14px 18px!important;

font-size:17px!important;

font-weight:750!important;

color:#f8fafc!important;

}

#summaryContent{

padding:4px 18px 17px!important;

}

#summaryContent .summary-row{

min-height:39px;

display:flex;

align-items:center;

justify-content:space-between;

gap:15px;

border-bottom:1px solid rgba(148,163,184,.10);

font-size:12px;

}

#summaryContent .summary-row span{

color:#aeb9c9;

}

#summaryContent .summary-row b{

color:#f1f5f9;

font-weight:750;

}

#summaryContent #detailsBtn{

width:100%;

height:40px;

margin-top:7px;

border:0;

border-radius:10px;

background:#1976e8;

color:#fff;

font-size:12px;

font-weight:750;

cursor:pointer;

}

#routeSummaryMinimizeBtn{

position:absolute!important;

top:10px!important;

right:10px!important;

width:30px!important;

height:30px!important;

border:1px solid rgba(148,163,184,.20)!important;

border-radius:8px!important;

background:rgba(30,41,59,.88)!important;

color:#cbd5e1!important;

font-size:19px!important;

cursor:pointer!important;

}

#routeSummaryRestoreBtn{

position:fixed!important;

left:18px!important;

bottom:18px!important;

min-width:128px!important;

height:40px!important;

display:none;

align-items:center!important;

justify-content:center!important;

border:1px solid rgba(59,130,246,.35)!important;

border-radius:10px!important;

background:rgba(15,23,42,.96)!important;

color:#e2e8f0!important;

font-size:12px!important;

font-weight:700!important;

cursor:pointer!important;

z-index:4001!important;

}

@media(max-width:800px){

#routeSummary{

left:12px!important;

right:12px!important;

bottom:12px!important;

width:auto!important;

}

#routeSummary h3{

padding:15px 48px 13px 15px!important;

font-size:16px!important;

}

#summaryContent{

padding:2px 15px 14px!important;

}

}

`;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   SUMMARY CONTROLS
========================================================= */

function setupRouteSummaryControls() {

    injectRouteSummaryStyles();

    const routeSummary =
        document.getElementById(
            "routeSummary"
        );

    if (!routeSummary) {

        return;
    }

    let minimizeButton =
        document.getElementById(
            "routeSummaryMinimizeBtn"
        );

    if (!minimizeButton) {

        minimizeButton =
            document.createElement(
                "button"
            );

        minimizeButton.id =
            "routeSummaryMinimizeBtn";

        minimizeButton.type =
            "button";

        minimizeButton.textContent =
            "−";

        minimizeButton.addEventListener(
            "click",
            function () {

                minimizeRouteSummary();
            }
        );

        routeSummary.appendChild(
            minimizeButton
        );
    }


    let restoreButton =
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if (!restoreButton) {

        restoreButton =
            document.createElement(
                "button"
            );

        restoreButton.id =
            "routeSummaryRestoreBtn";

        restoreButton.type =
            "button";

        restoreButton.textContent =
            "Route Summary";

        restoreButton.addEventListener(
            "click",
            function () {

                restoreRouteSummary();
            }
        );

        document.body.appendChild(
            restoreButton
        );
    }
}


function minimizeRouteSummary() {

    const routeSummary =
        document.getElementById(
            "routeSummary"
        );

    const restoreButton =
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if (!routeSummary) {

        return;
    }

    routeSummaryMinimized = true;

    routeSummary.style.setProperty(
        "display",
        "none",
        "important"
    );

    if (restoreButton) {

        restoreButton.style.setProperty(
            "display",
            "flex",
            "important"
        );
    }
}


function restoreRouteSummary() {

    const routeSummary =
        document.getElementById(
            "routeSummary"
        );

    const restoreButton =
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if (!routeSummary) {

        return;
    }

    routeSummaryMinimized = false;

    routeSummary.style.setProperty(
        "display",
        "block",
        "important"
    );

    if (restoreButton) {

        restoreButton.style.setProperty(
            "display",
            "none",
            "important"
        );
    }
}


/* =========================================================
   ROUTE SUMMARY
========================================================= */

function showRouteSummary(
    index
) {

    if (
        !routeResults[index]
    ) {

        return;
    }

    const route =
        routeResults[index];

    const aqi =
        Number(
            route.averageAQI
        );

    const maxAQI =
        Number(
            route.maxAQI
        );

    const category =
        route.category ||
        getAQICategory(
            aqi
        );

    const summaryContent =
        document.getElementById(
            "summaryContent"
        );

    const routeSummary =
        document.getElementById(
            "routeSummary"
        );

    if (
        !summaryContent ||
        !routeSummary
    ) {

        return;
    }

    summaryContent.innerHTML = `

<div class="summary-row">

<span>
Distance
</span>

<b>
${Number(route.distance).toFixed(2)}
km
</b>

</div>

<div class="summary-row">

<span>
Travel Time
</span>

<b>
${route.time}
mins
</b>

</div>

<div class="summary-row">

<span>
Average AQI
</span>

<b>
${Math.round(aqi)}
</b>

</div>

<div class="summary-row">

<span>
Maximum AQI
</span>

<b>
${Math.round(maxAQI)}
</b>

</div>

<div class="summary-row">

<span>
Status
</span>

<b>
${category}
</b>

</div>

<button id="detailsBtn">
View Details
</button>

`;

    setupRouteSummaryControls();

    routeSummaryMinimized = false;

    routeSummary.style.setProperty(
        "display",
        "block",
        "important"
    );
}


/* =========================================================
   =========================================================
   IMPORTANT TOUCH FIX
   =========================================================

   DO NOT wrap Leaflet's mapPane.

   DO NOT transform mapPane.

   DO NOT manually process touchmove.

   Leaflet itself handles:

   ✔ one-finger map movement
   ✔ two-finger pinch zoom
   ✔ touch dragging
   ✔ inertial movement
   ✔ desktop mouse dragging

   The previous custom rotation wrapper was interfering
   with Leaflet's coordinate calculations.

========================================================= */


/* =========================================================
   MOBILE NORTH BUTTON
========================================================= */

function createNorthButton() {

    if (
        document.getElementById(
            "mapRotationResetButton"
        )
    ) {

        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "mapRotationResetButton";

    button.type =
        "button";

    button.textContent =
        "N";

    button.title =
        "Reset map to north";

    button.setAttribute(
        "aria-label",
        "Reset map to north"
    );

    button.style.cssText = `
        position:fixed;
        right:14px;
        z-index:4500;
        width:38px;
        height:38px;
        padding:0;
        border:1px solid rgba(59,130,246,.55);
        border-radius:50%;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:13px;
        font-weight:800;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        cursor:pointer;
        touch-action:manipulation;
    `;

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            /*
               We no longer rotate the Leaflet map.
               N simply represents north-up.
            */

            if (
                typeof map !==
                "undefined" &&
                map
            ) {

                map.invalidateSize();
            }
        }
    );

    document.body.appendChild(
        button
    );

    positionNorthButton();
}


function positionNorthButton() {

    const button =
        document.getElementById(
            "mapRotationResetButton"
        );

    if (!button) {

        return;
    }

    const recenterButton =
        document.getElementById(
            "recenterMapBtn"
        );

    if (!recenterButton) {

        button.style.top =
            "270px";

        return;
    }

    const rect =
        recenterButton.getBoundingClientRect();

    button.style.top =
        (
            rect.bottom + 8
        ) + "px";
}


/* =========================================================
   SATELLITE MAP
========================================================= */

let satelliteMapLayer = null;
let satelliteMapActive = false;
let normalBaseLayers = [];


function captureNormalBaseLayers() {

    if (
        typeof map === "undefined" ||
        !map ||
        !map._layers
    ) {

        return;
    }

    normalBaseLayers = [];

    Object.keys(
        map._layers
    ).forEach(
        function (key) {

            const layer =
                map._layers[key];

            if (
                layer instanceof
                L.TileLayer
            ) {

                normalBaseLayers.push(
                    layer
                );
            }
        }
    );
}


function createSatelliteMapLayer() {

    if (satelliteMapLayer) {

        return;
    }

    satelliteMapLayer =
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom: 19,

                attribution:
                    "Tiles © Esri"
            }
        );
}


function setSatelliteMapMode() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }

    createSatelliteMapLayer();

    if (
        !normalBaseLayers.length
    ) {

        captureNormalBaseLayers();
    }

    normalBaseLayers.forEach(
        function (layer) {

            if (
                map.hasLayer(layer)
            ) {

                map.removeLayer(
                    layer
                );
            }
        }
    );

    satelliteMapLayer.addTo(
        map
    );

    satelliteMapActive =
        true;

    updateSatelliteButton();
}


function setNormalMapMode() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }

    if (satelliteMapLayer) {

        map.removeLayer(
            satelliteMapLayer
        );
    }

    let restored = false;

    normalBaseLayers.forEach(
        function (layer) {

            if (!restored) {

                layer.addTo(
                    map
                );

                restored = true;
            }
        }
    );

    satelliteMapActive =
        false;

    updateSatelliteButton();
}


function toggleSatelliteMap() {

    if (satelliteMapActive) {

        setNormalMapMode();

    } else {

        setSatelliteMapMode();
    }
}


function updateSatelliteButton() {

    const button =
        document.getElementById(
            "satelliteMapBtn"
        );

    if (!button) {

        return;
    }

    if (satelliteMapActive) {

        button.innerHTML =
            "🗺️&nbsp; Map";

        button.title =
            "Switch to normal map";

    } else {

        button.innerHTML =
            "🛰️&nbsp; Satellite";

        button.title =
            "Switch to satellite view";
    }
}


function createSatelliteMapButton() {

    if (
        document.getElementById(
            "satelliteMapBtn"
        )
    ) {

        return;
    }

    captureNormalBaseLayers();

    const button =
        document.createElement(
            "button"
        );

    button.id =
        "satelliteMapBtn";

    button.type =
        "button";

    button.innerHTML =
        "🛰️&nbsp; Satellite";

    button.title =
        "Switch to satellite view";

    button.style.cssText = `
        position:fixed;
        right:14px;
        z-index:4500;
        height:38px;
        padding:0 13px;
        border:1px solid rgba(59,130,246,.55);
        border-radius:20px;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        touch-action:manipulation;
    `;

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            toggleSatelliteMap();
        }
    );

    document.body.appendChild(
        button
    );

    positionSatelliteButton();
}


function positionSatelliteButton() {

    const button =
        document.getElementById(
            "satelliteMapBtn"
        );

    if (!button) {

        return;
    }

    const northButton =
        document.getElementById(
            "mapRotationResetButton"
        );

    const recenterButton =
        document.getElementById(
            "recenterMapBtn"
        );

    const referenceButton =
        northButton ||
        recenterButton;

    if (!referenceButton) {

        button.style.top =
            "270px";

        return;
    }

    const rect =
        referenceButton.getBoundingClientRect();

    button.style.top =
        (
            rect.bottom + 8
        ) + "px";
}


/* =========================================================
   FINAL INITIALIZATION
========================================================= */

function initializeMapControls() {

    /*
       IMPORTANT:

       We deliberately do NOT install any
       custom touchstart/touchmove/touchend handlers.

       Leaflet receives the touch events directly.
    */

    createNorthButton();

    createSatelliteMapButton();

    createRecenterButton();

    setTimeout(
        function () {

            positionNorthButton();
            positionSatelliteButton();
            setupLayersRecenterPosition();

        },
        300
    );

    setTimeout(
        function () {

            positionNorthButton();
            positionSatelliteButton();
            setupLayersRecenterPosition();

        },
        1000
    );

    window.addEventListener(
        "resize",
        function () {

            positionNorthButton();
            positionSatelliteButton();
            setupLayersRecenterPosition();

        }
    );
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMapControls
    );

} else {

    initializeMapControls();
}


/* =========================================================
   ENSURE LEAFLET TOUCH HANDLING
========================================================= */

if (
    typeof map !== "undefined" &&
    map
) {

    /*
       Re-enable Leaflet's normal touch interactions.

       These are the important ones for mobile:

       dragging  → left/right/up/down movement
       touchZoom → pinch zoom
    */

    if (
        map.dragging &&
        !map.dragging.enabled()
    ) {

        map.dragging.enable();
    }

    if (
        map.touchZoom &&
        !map.touchZoom.enabled()
    ) {

        map.touchZoom.enable();
    }

    if (
        map.scrollWheelZoom &&
        !map.scrollWheelZoom.enabled()
    ) {

        map.scrollWheelZoom.enable();
    }
}
/* =========================================================
   GOOGLE MAPS STYLE TOUCH CONTROLS
========================================================= */

/*
   1 FINGER
   ----------
   Normal Leaflet map dragging.

   2 FINGERS
   ----------
   • Pinch zoom
   • Two-finger pan
   • Two-finger rotation

   IMPORTANT:
   We do NOT wrap Leaflet's mapPane.
   We do NOT rotate the map container.
   We only rotate the visual Leaflet panes.

   This prevents the left/right dragging reversal
   that happened with the previous implementation.
*/


let mapRotationAngle = 0;

let mapRotationGesture = false;

let rotationGestureStart = {
    distance: 0,
    angle: 0,
    midpointX: 0,
    midpointY: 0,
    zoom: 0,
    rotation: 0
};

let rotationGestureLastMidpoint = null;

let rotationGestureInitialized = false;


/*
   Leaflet visual panes that should rotate together.
*/
const MAP_ROTATION_PANES = [
    "tilePane",
    "shadowPane",
    "overlayPane",
    "markerPane",
    "tooltipPane",
    "popupPane"
];


/* =========================================================
   ROTATION HELPERS
========================================================= */

function normalizeRotation(
    angle
) {

    while (
        angle > 180
    ) {

        angle -= 360;
    }

    while (
        angle < -180
    ) {

        angle += 360;
    }

    return angle;
}


function getTouchDistance(
    touch1,
    touch2
) {

    return Math.hypot(
        touch2.clientX -
        touch1.clientX,

        touch2.clientY -
        touch1.clientY
    );
}


function getTouchAngle(
    touch1,
    touch2
) {

    return Math.atan2(
        touch2.clientY -
        touch1.clientY,

        touch2.clientX -
        touch1.clientX
    ) * 180 / Math.PI;
}


function getTouchMidpoint(
    touch1,
    touch2
) {

    return {

        x:
            (
                touch1.clientX +
                touch2.clientX
            ) / 2,

        y:
            (
                touch1.clientY +
                touch2.clientY
            ) / 2
    };
}


/* =========================================================
   APPLY ROTATION
========================================================= */

function applyMapRotation() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    MAP_ROTATION_PANES.forEach(
        function (
            paneName
        ) {

            const pane =
                map.getPane(
                    paneName
                );


            if (!pane) {

                return;
            }


            let transform =
                pane.style.transform ||
                "";


            /*
               Remove the rotation that this code
               previously appended.
            */
            transform =
                transform.replace(
                    /\srotate\(\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:deg)?\s*\)\s*$/i,
                    ""
                );


            transform =
                transform.trim();


            /*
               If Leaflet has not supplied a transform,
               keep a valid transform origin.
            */
            if (
                !transform
            ) {

                transform =
                    "translate3d(0,0,0)";
            }


            pane.style.transformOrigin =
                "50% 50%";

            pane.style.webkitTransformOrigin =
                "50% 50%";


            pane.style.transform =
                transform +
                " rotate(" +
                mapRotationAngle +
                "deg)";


            pane.style.webkitTransform =
                transform +
                " rotate(" +
                mapRotationAngle +
                "deg)";
        }
    );
}


/* =========================================================
   REQUEST ROTATION UPDATE
========================================================= */

function scheduleMapRotationApply() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    if (
        window.requestAnimationFrame
    ) {

        window.requestAnimationFrame(
            function () {

                applyMapRotation();
            }
        );

    } else {

        setTimeout(
            function () {

                applyMapRotation();

            },
            0
        );
    }
}


/* =========================================================
   RESET ROTATION
========================================================= */

function resetMapRotation() {

    mapRotationAngle = 0;


    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    MAP_ROTATION_PANES.forEach(
        function (
            paneName
        ) {

            const pane =
                map.getPane(
                    paneName
                );


            if (!pane) {

                return;
            }


            let transform =
                pane.style.transform ||
                "";


            transform =
                transform.replace(
                    /\srotate\(\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:deg)?\s*\)\s*$/i,
                    ""
                );


            pane.style.transform =
                transform;

            pane.style.webkitTransform =
                transform;


            pane.style.transformOrigin =
                "";

            pane.style.webkitTransformOrigin =
                "";
        }
    );
}


/* =========================================================
   START TWO-FINGER GESTURE
========================================================= */

function startTwoFingerMapGesture(
    touch1,
    touch2
) {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    const midpoint =
        getTouchMidpoint(
            touch1,
            touch2
        );


    rotationGestureStart = {

        distance:
            getTouchDistance(
                touch1,
                touch2
            ),

        angle:
            getTouchAngle(
                touch1,
                touch2
            ),

        midpointX:
            midpoint.x,

        midpointY:
            midpoint.y,

        zoom:
            map.getZoom(),

        rotation:
            mapRotationAngle
    };


    rotationGestureLastMidpoint =
        midpoint;


    rotationGestureInitialized =
        true;


    mapRotationGesture =
        true;


    /*
       Temporarily disable Leaflet's native touch
       interactions while the two-finger gesture
       is being controlled here.
    */

    if (
        map.dragging &&
        map.dragging.enabled()
    ) {

        map.dragging.disable();
    }


    if (
        map.touchZoom &&
        map.touchZoom.enabled()
    ) {

        map.touchZoom.disable();
    }


    applyMapRotation();
}


/* =========================================================
   UPDATE TWO-FINGER GESTURE
========================================================= */

function updateTwoFingerMapGesture(
    touch1,
    touch2
) {

    if (
        typeof map ===
        "undefined" ||
        !map ||
        !rotationGestureInitialized
    ) {

        return;
    }


    const currentDistance =
        getTouchDistance(
            touch1,
            touch2
        );


    const currentAngle =
        getTouchAngle(
            touch1,
            touch2
        );


    const currentMidpoint =
        getTouchMidpoint(
            touch1,
            touch2
        );


    /* =====================================================
       ROTATION
    ===================================================== */

    const angleDelta =
        normalizeRotation(
            currentAngle -
            rotationGestureStart.angle
        );


    mapRotationAngle =
        normalizeRotation(
            rotationGestureStart.rotation +
            angleDelta
        );


    /* =====================================================
       PINCH ZOOM
    ===================================================== */

    let zoomDelta = 0;


    if (
        rotationGestureStart.distance > 0 &&
        currentDistance > 0
    ) {

        zoomDelta =
            Math.log(
                currentDistance /
                rotationGestureStart.distance
            ) /
            Math.LN2;
    }


    let targetZoom =
        rotationGestureStart.zoom +
        zoomDelta;


    targetZoom =
        Math.max(
            map.getMinZoom(),
            Math.min(
                map.getMaxZoom(),
                targetZoom
            )
        );


    /*
       Zoom around the actual two-finger midpoint.
    */

    try {

        map.setZoomAround(
            L.point(
                currentMidpoint.x,
                currentMidpoint.y
            ),

            targetZoom,

            {
                animate: false
            }
        );

    } catch (
        error
    ) {

        map.setZoom(
            targetZoom,
            {
                animate: false
            }
        );
    }


    /* =====================================================
       TWO-FINGER PAN
    ===================================================== */

    if (
        rotationGestureLastMidpoint
    ) {

        const deltaX =
            currentMidpoint.x -
            rotationGestureLastMidpoint.x;


        const deltaY =
            currentMidpoint.y -
            rotationGestureLastMidpoint.y;


        if (
            Math.abs(deltaX) > 0.1 ||
            Math.abs(deltaY) > 0.1
        ) {

            /*
               Positive delta means the map follows the
               fingers in the same direction.

               Therefore:
               finger left  -> map left
               finger right -> map right
            */

            map.panBy(
                L.point(
                    deltaX,
                    deltaY
                ),

                {
                    animate: false,
                    noMoveStart: true
                }
            );
        }
    }


    rotationGestureLastMidpoint =
        currentMidpoint;


    scheduleMapRotationApply();
}


/* =========================================================
   FINISH TWO-FINGER GESTURE
========================================================= */

function finishTwoFingerMapGesture() {

    if (
        !mapRotationGesture
    ) {

        return;
    }


    mapRotationGesture =
        false;


    rotationGestureInitialized =
        false;


    rotationGestureLastMidpoint =
        null;


    /*
       Restore normal Leaflet interactions.
    */

    if (
        typeof map !==
        "undefined" &&
        map
    ) {

        if (
            map.dragging &&
            !map.dragging.enabled()
        ) {

            map.dragging.enable();
        }


        if (
            map.touchZoom &&
            !map.touchZoom.enabled()
        ) {

            map.touchZoom.enable();
        }
    }


    scheduleMapRotationApply();
}


/* =========================================================
   INSTALL TOUCH CONTROLS
========================================================= */

function installGoogleMapsTouchControls() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    const container =
        map.getContainer();


    if (!container) {

        return;
    }


    if (
        container.dataset
            .googleTouchControlsInstalled ===
        "true"
    ) {

        return;
    }


    container.dataset
        .googleTouchControlsInstalled =
        "true";


    /*
       Do NOT use touch-action:none.

       Leaflet must continue receiving normal
       one-finger dragging.
    */

    container.style.webkitUserSelect =
        "none";

    container.style.userSelect =
        "none";


    /* =====================================================
       TOUCH START
    ===================================================== */

    container.addEventListener(
        "touchstart",

        function (
            event
        ) {

            if (
                event.touches.length >= 2
            ) {

                /*
                   Disable Leaflet's one-finger handler
                   as soon as the second finger appears.
                */

                if (
                    map.dragging &&
                    map.dragging.enabled()
                ) {

                    map.dragging.disable();
                }


                if (
                    map.touchZoom &&
                    map.touchZoom.enabled()
                ) {

                    map.touchZoom.disable();
                }


                startTwoFingerMapGesture(
                    event.touches[0],
                    event.touches[1]
                );


                event.preventDefault();
                event.stopPropagation();
            }

        },

        {
            passive: false,
            capture: true
        }
    );


    /* =====================================================
       TOUCH MOVE
    ===================================================== */

    container.addEventListener(
        "touchmove",

        function (
            event
        ) {

            if (
                mapRotationGesture &&
                event.touches.length >= 2
            ) {

                updateTwoFingerMapGesture(
                    event.touches[0],
                    event.touches[1]
                );


                event.preventDefault();
                event.stopPropagation();
            }

        },

        {
            passive: false,
            capture: true
        }
    );


    /* =====================================================
       TOUCH END
    ===================================================== */

    container.addEventListener(
        "touchend",

        function (
            event
        ) {

            if (
                !mapRotationGesture
            ) {

                return;
            }


            /*
               If two fingers still remain,
               continue the gesture.
            */

            if (
                event.touches.length >= 2
            ) {

                startTwoFingerMapGesture(
                    event.touches[0],
                    event.touches[1]
                );


                event.preventDefault();
                event.stopPropagation();


                return;
            }


            finishTwoFingerMapGesture();
        },

        {
            passive: false,
            capture: true
        }
    );


    /* =====================================================
       TOUCH CANCEL
    ===================================================== */

    container.addEventListener(
        "touchcancel",

        function () {

            finishTwoFingerMapGesture();

        },

        {
            passive: false,
            capture: true
        }
    );


    /* =====================================================
       RE-APPLY ROTATION AFTER LEAFLET MOVES
    ===================================================== */

    map.on(
        "move zoom zoomend moveend",

        function () {

            if (
                Math.abs(
                    mapRotationAngle
                ) > 0.01
            ) {

                scheduleMapRotationApply();
            }
        }
    );


    applyMapRotation();
}


/* =========================================================
   MOBILE NORTH BUTTON
========================================================= */

function createNorthButton() {

    if (
        document.getElementById(
            "mapRotationResetButton"
        )
    ) {

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "mapRotationResetButton";


    button.type =
        "button";


    button.textContent =
        "N";


    button.title =
        "Reset map to north";


    button.setAttribute(
        "aria-label",
        "Reset map to north"
    );


    button.style.cssText = `
        position:fixed;
        right:14px;
        z-index:4500;
        width:38px;
        height:38px;
        padding:0;
        border:1px solid rgba(59,130,246,.55);
        border-radius:50%;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:13px;
        font-weight:800;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        cursor:pointer;
        touch-action:manipulation;
    `;


    button.addEventListener(
        "click",

        function (
            event
        ) {

            event.preventDefault();
            event.stopPropagation();


            resetMapRotation();


            if (
                typeof map !==
                "undefined" &&
                map
            ) {

                map.invalidateSize();
            }
        }
    );


    document.body.appendChild(
        button
    );


    positionNorthButton();
}


function positionNorthButton() {

    const button =
        document.getElementById(
            "mapRotationResetButton"
        );


    if (!button) {

        return;
    }


    const recenterButton =
        document.getElementById(
            "recenterMapBtn"
        );


    if (!recenterButton) {

        button.style.top =
            "270px";

        return;
    }


    const rect =
        recenterButton.getBoundingClientRect();


    button.style.top =
        (
            rect.bottom + 8
        ) + "px";
}


/* =========================================================
   SATELLITE MAP
========================================================= */

let satelliteMapLayer = null;

let satelliteMapActive = false;

let normalBaseLayers = [];


function captureNormalBaseLayers() {

    if (
        typeof map ===
        "undefined" ||
        !map ||
        !map._layers
    ) {

        return;
    }


    normalBaseLayers = [];


    Object.keys(
        map._layers
    ).forEach(
        function (
            key
        ) {

            const layer =
                map._layers[key];


            if (
                layer instanceof
                L.TileLayer
            ) {

                normalBaseLayers.push(
                    layer
                );
            }
        }
    );
}


function createSatelliteMapLayer() {

    if (
        satelliteMapLayer
    ) {

        return;
    }


    satelliteMapLayer =
        L.tileLayer(

            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

            {
                maxZoom: 19,

                attribution:
                    "Tiles © Esri"
            }
        );
}


function setSatelliteMapMode() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    createSatelliteMapLayer();


    if (
        !normalBaseLayers.length
    ) {

        captureNormalBaseLayers();
    }


    normalBaseLayers.forEach(
        function (
            layer
        ) {

            if (
                map.hasLayer(
                    layer
                )
            ) {

                map.removeLayer(
                    layer
                );
            }
        }
    );


    satelliteMapLayer.addTo(
        map
    );


    satelliteMapActive =
        true;


    updateSatelliteButton();


    scheduleMapRotationApply();
}


function setNormalMapMode() {

    if (
        typeof map ===
        "undefined" ||
        !map
    ) {

        return;
    }


    if (
        satelliteMapLayer
    ) {

        map.removeLayer(
            satelliteMapLayer
        );
    }


    let restored =
        false;


    normalBaseLayers.forEach(
        function (
            layer
        ) {

            if (
                !restored
            ) {

                layer.addTo(
                    map
                );


                restored =
                    true;
            }
        }
    );


    satelliteMapActive =
        false;


    updateSatelliteButton();


    scheduleMapRotationApply();
}


function toggleSatelliteMap() {

    if (
        satelliteMapActive
    ) {

        setNormalMapMode();

    } else {

        setSatelliteMapMode();
    }
}


function updateSatelliteButton() {

    const button =
        document.getElementById(
            "satelliteMapBtn"
        );


    if (!button) {

        return;
    }


    if (
        satelliteMapActive
    ) {

        button.innerHTML =
            "🗺️&nbsp; Map";


        button.title =
            "Switch to normal map";

    } else {

        button.innerHTML =
            "🛰️&nbsp; Satellite";


        button.title =
            "Switch to satellite view";
    }
}


function createSatelliteMapButton() {

    if (
        document.getElementById(
            "satelliteMapBtn"
        )
    ) {

        return;
    }


    captureNormalBaseLayers();


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "satelliteMapBtn";


    button.type =
        "button";


    button.innerHTML =
        "🛰️&nbsp; Satellite";


    button.title =
        "Switch to satellite view";


    button.style.cssText = `
        position:fixed;
        right:14px;
        z-index:4500;
        height:38px;
        padding:0 13px;
        border:1px solid rgba(59,130,246,.55);
        border-radius:20px;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:12px;
        font-weight:700;
        cursor:pointer;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        touch-action:manipulation;
    `;


    button.addEventListener(
        "click",

        function (
            event
        ) {

            event.preventDefault();
            event.stopPropagation();


            toggleSatelliteMap();
        }
    );


    document.body.appendChild(
        button
    );


    positionSatelliteButton();
}


function positionSatelliteButton() {

    const button =
        document.getElementById(
            "satelliteMapBtn"
        );


    if (!button) {

        return;
    }


    const northButton =
        document.getElementById(
            "mapRotationResetButton"
        );


    const recenterButton =
        document.getElementById(
            "recenterMapBtn"
        );


    const referenceButton =
        northButton ||
        recenterButton;


    if (!referenceButton) {

        button.style.top =
            "270px";

        return;
    }


    const rect =
        referenceButton.getBoundingClientRect();


    button.style.top =
        (
            rect.bottom + 8
        ) + "px";
}


/* =========================================================
   FINAL INITIALIZATION
========================================================= */

function initializeMapControls() {

    createNorthButton();

    createSatelliteMapButton();

    createRecenterButton();

    installGoogleMapsTouchControls();


    setTimeout(
        function () {

            positionNorthButton();

            positionSatelliteButton();

            setupLayersRecenterPosition();

            installGoogleMapsTouchControls();

        },

        300
    );


    setTimeout(
        function () {

            positionNorthButton();

            positionSatelliteButton();

            setupLayersRecenterPosition();

            installGoogleMapsTouchControls();

        },

        1000
    );


    window.addEventListener(
        "resize",

        function () {

            positionNorthButton();

            positionSatelliteButton();

            setupLayersRecenterPosition();

        }
    );
}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMapControls
    );

} else {

    initializeMapControls();
}


/* =========================================================
   ENSURE LEAFLET TOUCH HANDLING
========================================================= */

if (
    typeof map !==
    "undefined" &&
    map
) {

    /*
       Normal one-finger dragging.
    */

    if (
        map.dragging &&
        !map.dragging.enabled()
    ) {

        map.dragging.enable();
    }


    /*
       Normal Leaflet pinch support remains enabled
       whenever our two-finger gesture is inactive.
    */

    if (
        map.touchZoom &&
        !map.touchZoom.enabled()
    ) {

        map.touchZoom.enable();
    }


    if (
        map.scrollWheelZoom &&
        !map.scrollWheelZoom.enabled()
    ) {

        map.scrollWheelZoom.enable();
    }


    installGoogleMapsTouchControls();
}
