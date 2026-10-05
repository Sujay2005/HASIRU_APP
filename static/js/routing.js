/* =========================================================
   routing.js — FULL CORRECTED VERSION
   ========================================================= */

/* ----------------------
   ROUTING STATE
---------------------- */

let userSelectedRoute=false;
let recommendedIndex=-1;
let fastestIndex=-1;
let selectedRoute=0;

let source=null;
let destination=null;

let sourceMarker=null;
let destinationMarker=null;

let routeSegmentsLayer=L.layerGroup().addTo(map);
let alternateRoutesLayer=L.layerGroup().addTo(map);

let routePolylines=[];
let routeResults=[];
let routeSummaryMinimized=false;


/* =========================================================
   LIVE NAVIGATION
========================================================= */

let navigationActive=false;
let navigationWatchId=null;
let navigationMarker=null;
let navigationRoutePolyline=null;
let navigationRouteCoords=null;
let lastNavigationRerouteTime=0;
let lastKnownNavigationPosition=null;

let navigationFollowMode=false;
let navigationFullRouteCoords=null;

const NAVIGATION_OFF_ROUTE_DISTANCE=50;
const NAVIGATION_DESTINATION_DISTANCE=30;
const NAVIGATION_REROUTE_COOLDOWN=5000;


/* =========================================================
   DISTANCE
========================================================= */

function getDistanceMeters(
    lat1,
    lng1,
    lat2,
    lng2
){

    const R=6371000;

    const dLat=
        (lat2-lat1)*
        Math.PI/180;

    const dLng=
        (lng2-lng1)*
        Math.PI/180;

    const a=
        Math.sin(dLat/2)*
        Math.sin(dLat/2)+
        Math.cos(lat1*Math.PI/180)*
        Math.cos(lat2*Math.PI/180)*
        Math.sin(dLng/2)*
        Math.sin(dLng/2);

    return R*
        2*
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );
}


/* =========================================================
   DISTANCE POINT TO ROUTE SEGMENT
========================================================= */

function distancePointToSegmentMeters(
    point,
    a,
    b
){

    const latScale=111320;

    const lngScale=
        111320*
        Math.cos(
            point.lat*Math.PI/180
        );

    const px=point.lng*lngScale;
    const py=point.lat*latScale;

    const ax=a[1]*lngScale;
    const ay=a[0]*latScale;

    const bx=b[1]*lngScale;
    const by=b[0]*latScale;

    const dx=bx-ax;
    const dy=by-ay;

    if(
        dx===0&&
        dy===0
    ){

        return Math.hypot(
            px-ax,
            py-ay
        );
    }

    let t=
        (
            (px-ax)*dx+
            (py-ay)*dy
        )/
        (
            dx*dx+
            dy*dy
        );

    t=
        Math.max(
            0,
            Math.min(
                1,
                t
            )
        );

    return Math.hypot(
        px-(ax+t*dx),
        py-(ay+t*dy)
    );
}


/* =========================================================
   DISTANCE TO ROUTE
========================================================= */

function distanceToRouteMeters(
    position,
    coords
){

    if(
        !coords||
        coords.length<2
    ){

        return Infinity;
    }

    let minimum=Infinity;

    for(
        let i=0;
        i<coords.length-1;
        i++
    ){

        minimum=
            Math.min(
                minimum,
                distancePointToSegmentMeters(
                    position,
                    coords[i],
                    coords[i+1]
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
){

    if(navigationMarker){

        navigationMarker.setLatLng([
            position.lat,
            position.lng
        ]);

        return;
    }

    navigationMarker=
        L.circleMarker(
            [
                position.lat,
                position.lng
            ],
            {
                radius:9,
                color:"#ffffff",
                weight:3,
                fillColor:"#1976e8",
                fillOpacity:1
            }
        ).addTo(map);
}


/* =========================================================
   DRAW LIVE NAVIGATION ROUTE
========================================================= */

function drawNavigationRoute(
    coords
){

    if(
        !coords||
        coords.length<2
    ){

        return;
    }

    navigationFullRouteCoords=
        coords.slice();

    navigationRouteCoords=
        coords.slice();

    if(navigationRoutePolyline){

        map.removeLayer(
            navigationRoutePolyline
        );
    }

    navigationRoutePolyline=
        L.polyline(
            coords,
            {
                color:"#1976e8",
                weight:7,
                opacity:.95
            }
        ).addTo(map);
}


/* =========================================================
   REMOVE TRAVELLED ROUTE
========================================================= */

function trimNavigationRoute(
    currentPosition
){

    if(
        !navigationActive||
        !navigationFullRouteCoords||
        navigationFullRouteCoords.length<2||
        !navigationRoutePolyline
    ){

        return;
    }

    let nearestIndex=0;
    let nearestDistance=Infinity;

    for(
        let i=0;
        i<navigationFullRouteCoords.length;
        i++
    ){

        const point=
            navigationFullRouteCoords[i];

        const distance=
            getDistanceMeters(
                currentPosition.lat,
                currentPosition.lng,
                point[0],
                point[1]
            );

        if(
            distance<
            nearestDistance
        ){

            nearestDistance=distance;
            nearestIndex=i;
        }
    }

    const remainingRoute=[
        [
            currentPosition.lat,
            currentPosition.lng
        ]
    ];

    for(
        let i=nearestIndex+1;
        i<navigationFullRouteCoords.length;
        i++
    ){

        remainingRoute.push(
            navigationFullRouteCoords[i]
        );
    }

    if(
        remainingRoute.length<2&&
        destination
    ){

        remainingRoute.push([
            destination.lat,
            destination.lng
        ]);
    }

    navigationRouteCoords=
        remainingRoute;

    navigationRoutePolyline.setLatLngs(
        remainingRoute
    );
}



/* =========================================================
   VOICE NAVIGATION
========================================================= */

const NAVIGATION_VOICE_ENABLED=true;
const NAVIGATION_VOICE_LANGUAGE="en-IN";

const NAVIGATION_VOICE_DISTANCES=[
    500,
    200,
    50
];

let navigationVoiceSteps=[];
let navigationVoiceStepIndex=0;
let navigationVoiceAnnounced={};


/* =========================================================
   VOICE SPEAK
========================================================= */

function navigationSpeak(text){

    if(
        !NAVIGATION_VOICE_ENABLED||
        !("speechSynthesis" in window)
    ){

        return;
    }

    window.speechSynthesis.cancel();

    const utterance=
        new SpeechSynthesisUtterance(
            text
        );

    utterance.lang=
        NAVIGATION_VOICE_LANGUAGE;

    utterance.rate=
        0.95;

    utterance.pitch=
        1.0;

    utterance.volume=
        1.0;

    window.speechSynthesis.speak(
        utterance
    );
}


/* =========================================================
   FORMAT NAVIGATION DISTANCE
========================================================= */

function formatNavigationDistance(
    meters
){

    if(meters>=1000){

        return(
            (meters/1000)
            .toFixed(1)+
            " kilometers"
        );
    }

    if(meters>=100){

        return(
            Math.round(meters/50)*50+
            " meters"
        );
    }

    return(
        Math.max(
            10,
            Math.round(meters/10)*10
        )+
        " meters"
    );
}


/* =========================================================
   TURN INSTRUCTION
========================================================= */

function getNavigationInstruction(
    step
){

    if(
        !step||
        !step.maneuver
    ){

        return"Continue";
    }

    const maneuver=
        step.maneuver;

    const type=
        maneuver.type||
        "";

    const modifier=
        maneuver.modifier||
        "";

    if(type==="arrive"){

        return"You have arrived at your destination.";
    }

    if(type==="depart"){

        return"Start navigation.";
    }

    if(
        type==="roundabout"||
        type==="rotary"
    ){

        if(maneuver.exit){

            return(
                "Enter the roundabout and take "+
                "exit number "+
                maneuver.exit+"."
            );
        }

        return"Enter the roundabout.";
    }

    if(type==="uturn"){

        return"Make a U-turn.";
    }

    if(type==="merge"){

        if(modifier.includes("left")){

            return"Merge left.";
        }

        if(modifier.includes("right")){

            return"Merge right.";
        }

        return"Merge.";
    }

    if(
        type==="on ramp"||
        type==="off ramp"||
        type==="ramp"
    ){

        if(modifier.includes("left")){

            return"Take the ramp on the left.";
        }

        if(modifier.includes("right")){

            return"Take the ramp on the right.";
        }

        return"Take the ramp.";
    }

    if(type==="fork"){

        if(modifier.includes("left")){

            return"Keep left at the fork.";
        }

        if(modifier.includes("right")){

            return"Keep right at the fork.";
        }

        return"Continue at the fork.";
    }

    if(modifier==="sharp left"){

        return"Turn sharp left.";
    }

    if(modifier==="sharp right"){

        return"Turn sharp right.";
    }

    if(modifier==="slight left"){

        return"Turn slightly left.";
    }

    if(modifier==="slight right"){

        return"Turn slightly right.";
    }

    if(modifier==="left"){

        return"Turn left.";
    }

    if(modifier==="right"){

        return"Turn right.";
    }

    if(modifier==="straight"){

        return"Continue straight.";
    }

    return"Continue.";
}


/* =========================================================
   BUILD VOICE STEPS FROM OSRM ROUTE
========================================================= */

function buildNavigationVoiceSteps(
    route
){

    navigationVoiceSteps=[];
    navigationVoiceStepIndex=0;
    navigationVoiceAnnounced={};

    if(
        !route||
        !route.legs||
        !route.legs.length
    ){

        return;
    }

    route.legs.forEach(
        function(leg){

            if(
                !leg.steps||
                !Array.isArray(
                    leg.steps
                )
            ){

                return;
            }

            leg.steps.forEach(
                function(step){

                    if(
                        !step.maneuver||
                        !step.maneuver.location
                    ){

                        return;
                    }

                    const location=
                        step.maneuver.location;

                    navigationVoiceSteps.push({

                        lat:
                            location[1],

                        lng:
                            location[0],

                        distance:
                            Number(
                                step.distance
                            )||0,

                        instruction:
                            getNavigationInstruction(
                                step
                            )
                    });
                }
            );
        }
    );
}


/* =========================================================
   UPDATE VOICE GUIDANCE
========================================================= */

function updateNavigationVoice(
    currentPosition
){

    if(
        !navigationActive||
        navigationVoiceSteps.length===0
    ){

        return;
    }

    while(
        navigationVoiceStepIndex<
        navigationVoiceSteps.length
    ){

        const step=
            navigationVoiceSteps[
                navigationVoiceStepIndex
            ];

        const distance=
            getDistanceMeters(
                currentPosition.lat,
                currentPosition.lng,
                step.lat,
                step.lng
            );

        const stepId=
            navigationVoiceStepIndex;

        if(distance<=20){

            const key=
                stepId+"_now";

            if(
                !navigationVoiceAnnounced[key]
            ){

                navigationVoiceAnnounced[key]=
                    true;

                navigationSpeak(
                    step.instruction
                );
            }

            navigationVoiceStepIndex++;

            continue;
        }

        for(
            let i=0;
            i<NAVIGATION_VOICE_DISTANCES.length;
            i++
        ){

            const leadDistance=
                NAVIGATION_VOICE_DISTANCES[i];

            const key=
                stepId+"_"+leadDistance;

            if(
                distance<=leadDistance&&
                !navigationVoiceAnnounced[key]
            ){

                navigationVoiceAnnounced[key]=
                    true;

                navigationSpeak(
                    step.instruction+
                    " In "+
                    formatNavigationDistance(
                        distance
                    )+"."
                );

                break;
            }
        }

        break;
    }
}


/* =========================================================
   RESET VOICE NAVIGATION
========================================================= */

function resetNavigationVoice(){

    navigationVoiceSteps=[];
    navigationVoiceStepIndex=0;
    navigationVoiceAnnounced={};

    if(
        "speechSynthesis" in window
    ){

        window.speechSynthesis.cancel();
    }
}


/* =========================================================
   START VOICE
========================================================= */

function announceNavigationStart(){

    navigationSpeak(
        "Navigation started."
    );
}


/* =========================================================
   REROUTING
========================================================= */

async function rerouteNavigation(
    position
){

    if(
        !navigationActive||
        !destination
    ){

        return;
    }

    const now=Date.now();

    if(
        now-
        lastNavigationRerouteTime<
        NAVIGATION_REROUTE_COOLDOWN
    ){

        return;
    }

    lastNavigationRerouteTime=now;

    try{

        const url=
            "https://router.project-osrm.org/route/v1/driving/"+
            `${position.lng},${position.lat};${destination.lng},${destination.lat}`+
            "?overview=full&geometries=geojson&steps=true";

        const response=
            await fetch(url);

        if(!response.ok){

            return;
        }

        const data=
            await response.json();

        if(
            !data.routes||
            !data.routes.length
        ){

            return;
        }

        const coords=
            data.routes[0]
                .geometry
                .coordinates
                .map(
                    function(c){

                        return[
                            c[1],
                            c[0]
                        ];
                    }
                );

        drawNavigationRoute(
            coords
        );

        source={
            lat:position.lat,
            lng:position.lng
        };

    }catch(error){

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
){

    if(
        !navigationActive
    ){

        return;
    }

    const currentPosition={
        lat:
            position.coords.latitude,

        lng:
            position.coords.longitude
    };

    lastKnownNavigationPosition=
        currentPosition;

    source=
        currentPosition;

    createNavigationMarker(
        currentPosition
    );

    if(
        navigationFollowMode
    ){

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
                animate:true
            }
        );
    }

    trimNavigationRoute(
        currentPosition
    );

    updateNavigationVoice(
        currentPosition
    );

    const distanceToDestination=
        getDistanceMeters(
            currentPosition.lat,
            currentPosition.lng,
            destination.lat,
            destination.lng
        );

    if(
        distanceToDestination<=
        NAVIGATION_DESTINATION_DISTANCE
    ){

        stopNavigation(true);

        return;
    }

    if(
        navigationRouteCoords&&
        navigationRouteCoords.length>1
    ){

        const routeDistance=
            distanceToRouteMeters(
                currentPosition,
                navigationRouteCoords
            );

        if(
            routeDistance>
            NAVIGATION_OFF_ROUTE_DISTANCE
        ){

            rerouteNavigation(
                currentPosition
            );
        }
    }
}


/* =========================================================
   START NAVIGATION
========================================================= */

function startNavigation(){

    if(
        navigationActive||
        !source||
        !destination||
        !routeResults[selectedRoute]
    ){

        return;
    }

    navigationActive=true;
    navigationFollowMode=true;
    lastNavigationRerouteTime=0;

    if(sourceMarker){

        sourceMarker.setOpacity(0);
    }

    navigationRouteCoords=
        routeResults[
            selectedRoute
        ].routeCoords||
        null;

    if(navigationRouteCoords){

        drawNavigationRoute(
            navigationRouteCoords
        );
    }

    lastKnownNavigationPosition={
        lat:source.lat,
        lng:source.lng
    };

    createNavigationMarker(
        lastKnownNavigationPosition
    );

    if(
        navigationWatchId!==null
    ){

        navigator.geolocation.clearWatch(
            navigationWatchId
        );
    }

    if(
        routeResults[selectedRoute]&&
        routeResults[selectedRoute].originalRoute
    ){

        buildNavigationVoiceSteps(
            routeResults[
                selectedRoute
            ].originalRoute
        );
    }

    announceNavigationStart();

    navigationWatchId=
        navigator.geolocation.watchPosition(
            updateNavigationPosition,

            function(error){

                console.warn(
                    "Navigation GPS error:",
                    error
                );
            },

            {
                enableHighAccuracy:true,
                maximumAge:2000,
                timeout:10000
            }
        );
}


/* =========================================================
   STOP NAVIGATION
========================================================= */

function stopNavigation(
    reachedDestination
){

    navigationActive=false;
    navigationFollowMode=false;
    navigationFullRouteCoords=null;

    if(
        navigationWatchId!==null
    ){

        navigator.geolocation.clearWatch(
            navigationWatchId
        );

        navigationWatchId=null;
    }

    if(navigationMarker){

        map.removeLayer(
            navigationMarker
        );

        navigationMarker=null;
    }

    if(navigationRoutePolyline){

        map.removeLayer(
            navigationRoutePolyline
        );

        navigationRoutePolyline=null;
    }

    navigationRouteCoords=null;
    lastKnownNavigationPosition=null;

    resetNavigationVoice();

    if(sourceMarker){

        sourceMarker.setOpacity(1);
    }

    if(reachedDestination){

        alert(
            "You have reached your destination."
        );
    }
}


/* =========================================================
   RE-CENTER
========================================================= */

function recenterMap(){

    if(navigationActive){

        navigationFollowMode=true;
    }

    let target=null;

    if(navigationMarker){

        target=
            navigationMarker.getLatLng();

    }else if(lastKnownNavigationPosition){

        target=
            lastKnownNavigationPosition;

    }else if(source){

        target=source;
    }

    if(target){

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
                animate:true
            }
        );
    }

    if(
        !navigator.geolocation
    ){

        return;
    }

    navigator.geolocation.getCurrentPosition(

        function(position){

            const current={
                lat:
                    position.coords.latitude,

                lng:
                    position.coords.longitude
            };

            source=current;

            lastKnownNavigationPosition=
                current;

            createNavigationMarker(
                current
            );

            if(sourceMarker){

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
                    animate:true
                }
            );
        },

        function(error){

            console.warn(
                "Re-center GPS error:",
                error
            );
        },

        {
            enableHighAccuracy:true,
            timeout:10000,
            maximumAge:2000
        }
    );
}


/* =========================================================
   RE-CENTER BUTTON
========================================================= */

function createRecenterButton(){

    if(
        document.getElementById(
            "recenterMapBtn"
        )
    ){

        return;
    }

    const button=
        document.createElement(
            "button"
        );

    button.id=
        "recenterMapBtn";

    button.type=
        "button";

    button.innerHTML=
        "◉&nbsp; Re-center";

    button.title=
        "Center map on my current location";

    button.setAttribute(
        "aria-label",
        "Center map on my current location"
    );

    button.style.cssText=`
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
    `;

    button.addEventListener(
        "click",
        function(event){

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
   POSITION RE-CENTER
========================================================= */

function setupLayersRecenterPosition(){

    const recenterButton=
        document.getElementById(
            "recenterMapBtn"
        );

    if(!recenterButton){

        return;
    }

    const layersControl=
        document.querySelector(
            ".leaflet-control-layers"
        );

    if(!layersControl){

        return;
    }

    function updateRecenterPosition(){

        const rect=
            layersControl.getBoundingClientRect();

        if(!rect){

            return;
        }

        recenterButton.style.top=
            (rect.bottom+10)+"px";
    }

    updateRecenterPosition();

    const observer=
        new MutationObserver(
            function(){

                requestAnimationFrame(
                    updateRecenterPosition
                );
            }
        );

    observer.observe(
        layersControl,
        {
            attributes:true,
            attributeFilter:[
                "class",
                "style"
            ]
        }
    );

    window.addEventListener(
        "resize",
        updateRecenterPosition
    );
}


/* =========================================================
   INITIALIZE RE-CENTER
========================================================= */

function initializeRecenterButton(){

    createRecenterButton();

    setTimeout(
        setupLayersRecenterPosition,
        300
    );
}

if(
    document.readyState===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        initializeRecenterButton
    );

}else{

    initializeRecenterButton();
}

window.recenterMap=
    recenterMap;


/* =========================================================
   AQI
========================================================= */

function getAQIColor(aqi){

    aqi=Number(aqi);

    if(!Number.isFinite(aqi)){

        aqi=0;
    }

    if(aqi<=50)
        return"#00e400";

    if(aqi<=100)
        return"#ffff00";

    if(aqi<=200)
        return"#ff7e00";

    if(aqi<=300)
        return"#ff0000";

    if(aqi<=400)
        return"#8f3f97";

    return"#7e0023";
}


function getAQICategory(aqi){

    aqi=Number(aqi);

    if(!Number.isFinite(aqi)){

        aqi=0;
    }

    if(aqi<=50)
        return"Good";

    if(aqi<=100)
        return"Satisfactory";

    if(aqi<=200)
        return"Moderate";

    if(aqi<=300)
        return"Poor";

    if(aqi<=400)
        return"Very Poor";

    return"Severe";
}


/* =========================================================
   CLOSE MOBILE SIDEBAR
========================================================= */

function closeSidebarAfterRoute(){

    if(
        window.innerWidth<=800&&
        typeof closeMobileSidebar==="function"
    ){

        setTimeout(
            function(){

                closeMobileSidebar();

            },
            300
        );
    }
}


/* =========================================================
   ROUTE SELECTION
========================================================= */

function selectRoute(index){

    if(
        !routePolylines[index]||
        !routeResults[index]
    ){

        return;
    }

    userSelectedRoute=true;
    selectedRoute=index;

    routePolylines.forEach(
        function(polyline,i){

            if(i===index){

                if(
                    !alternateRoutesLayer.hasLayer(
                        polyline
                    )
                ){

                    polyline.addTo(
                        alternateRoutesLayer
                    );
                }

                polyline.setStyle({
                    weight:10,
                    opacity:1
                });

            }else{

                if(
                    alternateRoutesLayer.hasLayer(
                        polyline
                    )
                ){

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

    if(
        navigationActive&&
        routeResults[index].routeCoords
    ){

        drawNavigationRoute(
            routeResults[index].routeCoords
        );
    }

    if(
        typeof map!=="undefined"&&
        map&&
        !navigationActive
    ){

        map.fitBounds(
            routePolylines[index].getBounds(),
            {
                padding:[30,30]
            }
        );
    }
}


/* =========================================================
   DRAW ROUTE
========================================================= */

async function drawRoute(){

    if(
        !source||
        !destination
    ){

        return;
    }

    const loadingOverlay=
        document.getElementById(
            "loadingOverlay"
        );

    if(loadingOverlay){

        loadingOverlay.style.display=
            "flex";
    }

    try{

        const url=
            "https://router.project-osrm.org/route/v1/driving/"+
            `${source.lng},${source.lat};`+
            `${destination.lng},${destination.lat}`+
            "?overview=full&geometries=geojson&steps=true&alternatives=true";

        const response=
            await fetch(url);

        if(!response.ok){

            throw new Error(
                "OSRM request failed: HTTP "+
                response.status
            );
        }

        const data=
            await response.json();

        if(
            !data.routes||
            data.routes.length===0
        ){

            alert(
                "No route found"
            );

            return;
        }

        const routes=
            data.routes;

        routeResults=[];
        routePolylines=[];

        recommendedIndex=-1;
        fastestIndex=-1;
        selectedRoute=0;
        userSelectedRoute=false;

        alternateRoutesLayer.clearLayers();
        routeSegmentsLayer.clearLayers();

        const routeInfo=
            document.getElementById(
                "routeInfo"
            );

        if(routeInfo){

            routeInfo.innerHTML="";
        }

        const routeColors=[
            "blue",
            "green",
            "purple"
        ];

        routes.forEach(
            function(route,index){

                const routeLatLngs=
                    route.geometry.coordinates.map(
                        function(coordinate){

                            return[
                                coordinate[1],
                                coordinate[0]
                            ];
                        }
                    );

                const polyline=
                    L.polyline(
                        routeLatLngs,
                        {
                            color:
                                routeColors[
                                    index%
                                    routeColors.length
                                ],
                            weight:5,
                            opacity:0.7
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
                    function(){

                        selectRoute(index);

                    }
                );
            }
        );


        const routePromises=
            routes.map(
                async function(route,index){

                    const routeCoords=
                        route.geometry.coordinates.map(
                            function(coordinate){

                                return[
                                    coordinate[1],
                                    coordinate[0]
                                ];
                            }
                        );

                    const mins=
                        (
                            route.duration/60
                        ).toFixed(1);

                    let aqiData={
                        average_aqi:0,
                        max_aqi:0,
                        exposure_score:0,
                        category:"Unknown"
                    };

                    let futureAQI={
                        average_aqi:null
                    };


                    try{

                        const response=
                            await fetch(
                                "/route_aqi",
                                {
                                    method:"POST",
                                    headers:{
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

                        if(response.ok){

                            const result=
                                await response.json();

                            if(result){

                                aqiData=result;
                            }
                        }

                    }catch(error){

                        console.warn(
                            "Current AQI unavailable:",
                            error
                        );
                    }


                    try{

                        const response=
                            await fetch(
                                "/future_route_aqi",
                                {
                                    method:"POST",
                                    headers:{
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

                        if(response.ok){

                            const result=
                                await response.json();

                            if(result){

                                futureAQI=result;
                            }
                        }

                    }catch(error){

                        console.warn(
                            "Future AQI unavailable:",
                            error
                        );
                    }


                    const averageAQI=
                        Number(
                            aqiData.average_aqi
                        );

                    const maxAQI=
                        Number(
                            aqiData.max_aqi
                        );

                    const exposure=
                        Number(
                            aqiData.exposure_score
                        );

                    return{

                        routeNumber:
                            index+1,

                        distance:
                            (
                                route.distance/1000
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
                            aqiData.category||
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


        routeResults=
            await Promise.all(
                routePromises
            );


        if(
            routeResults.length>0
        ){

            recommendedIndex=0;
            fastestIndex=0;

            routeResults.forEach(
                function(route,index){

                    if(
                        route.exposure<
                        routeResults[
                            recommendedIndex
                        ].exposure
                    ){

                        recommendedIndex=
                            index;
                    }

                    if(
                        parseFloat(route.time)<
                        parseFloat(
                            routeResults[
                                fastestIndex
                            ].time
                        )
                    ){

                        fastestIndex=
                            index;
                    }
                }
            );
        }


        renderRouteCards();

        if(
            recommendedIndex>=0&&
            routePolylines[
                recommendedIndex
            ]
        ){

            selectedRoute=
                recommendedIndex;

            routePolylines[
                recommendedIndex
            ].setStyle({
                weight:10,
                opacity:1
            });

            showRouteSummary(
                recommendedIndex
            );

            loadRouteSegments(
                recommendedIndex
            );

            buildNavigationVoiceSteps(
                routeResults[
                    recommendedIndex
                ].originalRoute
            );
        }


        if(
            routePolylines.length>0
        ){

            const bounds=
                L.featureGroup(
                    routePolylines
                ).getBounds();

            if(bounds.isValid()){

                map.fitBounds(
                    bounds,
                    {
                        padding:[30,30]
                    }
                );
            }
        }

        closeSidebarAfterRoute();

        startNavigation();

    }catch(error){

        console.error(
            "Route request failed:",
            error
        );

        alert(
            "Route request failed"
        );

    }finally{

        if(loadingOverlay){

            loadingOverlay.style.display=
                "none";
        }
    }
}


/* =========================================================
   ROUTE SUMMARY STYLES
========================================================= */

function injectRouteSummaryStyles(){

    if(
        document.getElementById(
            "routeSummaryProfessionalStyles"
        )
    ){

        return;
    }

    const style=
        document.createElement(
            "style"
        );

    style.id=
        "routeSummaryProfessionalStyles";

    style.textContent=`

#routeSummary{

position:fixed!important;

left:18px!important;

right:auto!important;

top:auto!important;

bottom:18px!important;

width:350px!important;

max-width:calc(100vw - 36px)!important;

max-height:calc(100vh - 36px);

box-sizing:border-box;

margin:0!important;

padding:0!important;

overflow:hidden;

z-index:4000!important;

background:rgba(15,23,42,.94)!important;

border:1px solid rgba(148,163,184,.18)!important;

border-radius:18px!important;

box-shadow:0 18px 45px rgba(0,0,0,.34)!important;

backdrop-filter:blur(14px);

-webkit-backdrop-filter:blur(14px);

color:#f8fafc;

transform:none!important;

}

#routeSummary h3{

margin:0!important;

padding:17px 52px 14px 18px!important;

font-size:17px!important;

line-height:1.2!important;

font-weight:750!important;

color:#f8fafc!important;

border-bottom:1px solid rgba(148,163,184,.13)!important;

}

#summaryContent{

padding:4px 18px 17px!important;

box-sizing:border-box;

color:#cbd5e1;

}

#summaryContent .summary-row{

min-height:39px;

display:flex;

align-items:center;

justify-content:space-between;

gap:15px;

border-bottom:1px solid rgba(148,163,184,.10);

font-size:12px;

line-height:1.3;

}

#summaryContent .summary-row span{

color:#aeb9c9;

font-weight:500;

}

#summaryContent .summary-row b{

color:#f1f5f9;

font-weight:750;

text-align:right;

white-space:nowrap;

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

display:flex!important;

align-items:center!important;

justify-content:center!important;

padding:0!important;

border:1px solid rgba(148,163,184,.20)!important;

border-radius:8px!important;

background:rgba(30,41,59,.88)!important;

color:#cbd5e1!important;

font-size:19px!important;

cursor:pointer!important;

z-index:50!important;

}

#routeSummaryRestoreBtn{

position:fixed!important;

left:18px!important;

right:auto!important;

bottom:18px!important;

min-width:128px!important;

height:40px!important;

padding:0 16px!important;

display:none;

align-items:center!important;

justify-content:center!important;

border:1px solid rgba(59,130,246,.35)!important;

border-radius:10px!important;

background:rgba(15,23,42,.96)!important;

color:#e2e8f0!important;

box-shadow:0 10px 28px rgba(0,0,0,.30)!important;

font-size:12px!important;

font-weight:700!important;

cursor:pointer!important;

z-index:4001!important;

backdrop-filter:blur(12px);

}

@media(max-width:800px){

#routeSummary{

left:12px!important;

right:12px!important;

bottom:12px!important;

width:auto!important;

max-width:none!important;

max-height:calc(100vh - 90px);

border-radius:16px!important;

}

#routeSummary h3{

padding:15px 48px 13px 15px!important;

font-size:16px!important;

}

#summaryContent{

padding:2px 15px 14px!important;

}

#summaryContent .summary-row{

min-height:36px;

font-size:11px;

}

#summaryContent #detailsBtn{

height:39px;

}

#routeSummaryMinimizeBtn{

top:8px!important;

right:8px!important;

width:28px!important;

height:28px!important;

}

#routeSummaryRestoreBtn{

left:12px!important;

bottom:12px!important;

min-width:112px!important;

height:38px!important;

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

function setupRouteSummaryControls(){

    injectRouteSummaryStyles();

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    if(!routeSummary){

        return;
    }

    let minimizeButton=
        document.getElementById(
            "routeSummaryMinimizeBtn"
        );

    if(!minimizeButton){

        minimizeButton=
            document.createElement(
                "button"
            );

        minimizeButton.id=
            "routeSummaryMinimizeBtn";

        minimizeButton.type=
            "button";

        minimizeButton.textContent=
            "−";

        minimizeButton.addEventListener(
            "click",
            function(event){

                event.preventDefault();
                event.stopPropagation();

                minimizeRouteSummary();
            }
        );

        routeSummary.appendChild(
            minimizeButton
        );
    }


    let restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(!restoreButton){

        restoreButton=
            document.createElement(
                "button"
            );

        restoreButton.id=
            "routeSummaryRestoreBtn";

        restoreButton.type=
            "button";

        restoreButton.textContent=
            "Route Summary";

        restoreButton.addEventListener(
            "click",
            function(event){

                event.preventDefault();
                event.stopPropagation();

                restoreRouteSummary();
            }
        );

        document.body.appendChild(
            restoreButton
        );
    }
}


function minimizeRouteSummary(){

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(!routeSummary){

        return;
    }

    routeSummaryMinimized=true;

    routeSummary.style.setProperty(
        "display",
        "none",
        "important"
    );

    if(restoreButton){

        restoreButton.style.setProperty(
            "display",
            "flex",
            "important"
        );
    }
}


function restoreRouteSummary(){

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(!routeSummary){

        return;
    }

    routeSummaryMinimized=false;

    routeSummary.style.setProperty(
        "display",
        "block",
        "important"
    );

    if(restoreButton){

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

function showRouteSummary(index){

    if(
        !routeResults[index]
    ){

        return;
    }

    const route=
        routeResults[index];

    const aqi=
        Number(
            route.averageAQI
        );

    const maxAQI=
        Number(
            route.maxAQI
        );

    const category=
        route.category||
        getAQICategory(
            aqi
        );

    const summaryContent=
        document.getElementById(
            "summaryContent"
        );

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    if(
        !summaryContent||
        !routeSummary
    ){

        return;
    }

    summaryContent.innerHTML=
        "<div class='summary-row'>"+
        "<span>Distance</span>"+
        "<b>"+
        Number(route.distance).toFixed(2)+
        " km"+
        "</b>"+
        "</div>"+

        "<div class='summary-row'>"+
        "<span>Travel Time</span>"+
        "<b>"+
        route.time+
        " mins"+
        "</b>"+
        "</div>"+

        "<div class='summary-row'>"+
        "<span>Average AQI</span>"+
        "<b>"+
        Math.round(aqi)+
        "</b>"+
        "</div>"+

        "<div class='summary-row'>"+
        "<span>Maximum AQI</span>"+
        "<b>"+
        Math.round(maxAQI)+
        "</b>"+
        "</div>"+

        "<div class='summary-row'>"+
        "<span>Status</span>"+
        "<b>"+
        category+
        "</b>"+
        "</div>"+

        "<button id='detailsBtn'>"+
        "View Details"+
        "</button>";

    setupRouteSummaryControls();

    routeSummaryMinimized=false;

    routeSummary.style.setProperty(
        "display",
        "block",
        "important"
    );

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(restoreButton){

        restoreButton.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    const detailsBtn=
        document.getElementById(
            "detailsBtn"
        );

    if(!detailsBtn){

        return;
    }

    detailsBtn.onclick=
        function(){

            const modal=
                document.getElementById(
                    "detailsModal"
                );

            const detailsContent=
                document.getElementById(
                    "detailsContent"
                );

            if(
                !modal||
                !detailsContent
            ){

                return;
            }

            modal.style.display=
                "block";

            const futureAQI=
                route.futureAQI||
                {};

            const futureAverageAQI=
                Number(
                    futureAQI.average_aqi
                );

            detailsContent.innerHTML=`

<div class="detailsHeader">
Route Details
</div>

<div class="detailRow">
<span>Distance</span>
<b>
${Number(route.distance).toFixed(2)}
km
</b>
</div>

<div class="detailRow">
<span>Travel Time</span>
<b>
${route.time} mins
</b>
</div>

<div class="detailRow">
<span>Average AQI</span>
<b>
${Math.round(aqi)}
</b>
</div>

<div class="detailRow">
<span>Maximum AQI</span>
<b>
${Math.round(maxAQI)}
</b>
</div>

<div class="detailRow">
<span>Exposure</span>
<b>
${Math.round(Number(route.exposure)||0)}
</b>
</div>

<div class="detailRow">
<span>Future AQI</span>
<b>
${
Number.isFinite(
futureAverageAQI
)
?
Math.round(
futureAverageAQI
)
:
"N/A"
}
</b>
</div>

<div class="detailRow">
<span>AQI Status</span>
<b>
${category}
</b>
</div>

<hr>

<div class="healthCard">
${getHealthAdvice(category)}
</div>

`;
        };
}


/* =========================================================
   ROUTE SEGMENTS
========================================================= */

async function loadRouteSegments(index){

    if(
        !routeResults[index]
    ){

        return;
    }

    const route=
        routeResults[index];

    const routeCoords=
        route.routeCoords;

    if(
        !routeCoords||
        routeCoords.length<2
    ){

        return;
    }

    try{

        const response=
            await fetch(
                "/route_segments",
                {
                    method:"POST",
                    headers:{
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

        if(!response.ok){

            return;
        }

        const segmentData=
            await response.json();

        if(
            !Array.isArray(segmentData)||
            segmentData.length<2
        ){

            return;
        }

        if(
            index!==selectedRoute
        ){

            return;
        }

        routeSegmentsLayer.clearLayers();

        for(
            let i=0;
            i<segmentData.length-1;
            i++
        ){

            const p1=
                segmentData[i];

            const p2=
                segmentData[i+1];

            const segment=
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
                        weight:8,
                        opacity:1
                    }
                );

            segment.bindPopup(
                "<b>Segment AQI</b><br>"+
                "AQI: "+
                Math.round(
                    Number(p1.aqi)
                )
            );

            routeSegmentsLayer.addLayer(
                segment
            );
        }

    }catch(error){

        console.error(
            "Route segment error:",
            error
        );
    }
}


/* =========================================================
   GEOCODING
========================================================= */

async function geocode(place){

    /*
       IMPORTANT:
       RNS is hard-coded here as well as in the backend.

       This prevents the selected autocomplete text from
       being sent to another geocoder and returning a
       different RNS location.
    */

    const normalizedPlace=
        String(
            place||""
        )
        .trim()
        .toLowerCase();

    if(
        normalizedPlace.includes(
            "rns institute of technology"
        )||
        normalizedPlace.includes(
            "rnsit"
        )||
        normalizedPlace==="rns"
    ){

        return{
            lat:12.900733,
            lng:77.518175
        };
    }


    const url=
        "/geocode?q="+
        encodeURIComponent(
            place
        );

    const response=
        await fetch(
            url
        );

    if(!response.ok){

        throw new Error(
            "Geocoding failed: HTTP "+
            response.status
        );
    }

    const data=
        await response.json();

    if(
        !Array.isArray(data)||
        data.length===0
    ){

        throw new Error(
            "Location not found"
        );
    }

    const lat=
        parseFloat(
            data[0].lat
        );

    const lng=
        parseFloat(
            data[0].lon
        );

    if(
        !Number.isFinite(lat)||
        !Number.isFinite(lng)
    ){

        throw new Error(
            "Invalid coordinates"
        );
    }

    return{
        lat:lat,
        lng:lng
    };
}


/* =========================================================
   FIND ROUTE
========================================================= */

async function findRoute(){

    try{

        userSelectedRoute=false;

        recommendedIndex=-1;
        fastestIndex=-1;
        selectedRoute=0;

        const sourceInput=
            document.getElementById(
                "sourceInput"
            );

        const destinationInput=
            document.getElementById(
                "destinationInput"
            );

        if(
            !sourceInput||
            !destinationInput
        ){

            return;
        }

        const destinationText=
            destinationInput.value.trim();

        if(!destinationText){

            alert(
                "Enter destination"
            );

            return;
        }

        const loadingOverlay=
            document.getElementById(
                "loadingOverlay"
            );

        if(loadingOverlay){

            loadingOverlay.style.display=
                "flex";
        }

        const position=
            await new Promise(
                function(resolve,reject){

                    if(
                        !navigator.geolocation
                    ){

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
                            enableHighAccuracy:true,
                            timeout:15000,
                            maximumAge:0
                        }
                    );
                }
            );

        source={
            lat:
                position.coords.latitude,

            lng:
                position.coords.longitude
        };


        /*
           RNS will ALWAYS use the exact hard-coded
           coordinates above.
        */

        destination=
            await geocode(
                destinationText
            );


        if(sourceMarker){

            map.removeLayer(
                sourceMarker
            );

            sourceMarker=null;
        }

        if(destinationMarker){

            map.removeLayer(
                destinationMarker
            );

            destinationMarker=null;
        }

        sourceMarker=
            L.marker(
                source
            )
            .addTo(map)
            .bindPopup(
                "Source"
            );

        destinationMarker=
            L.marker(
                destination
            )
            .addTo(map)
            .bindPopup(
                "Destination"
            );

        await drawRoute();

    }catch(error){

        console.error(
            "Find route error:",
            error
        );

        const loadingOverlay=
            document.getElementById(
                "loadingOverlay"
            );

        if(loadingOverlay){

            loadingOverlay.style.display=
                "none";
        }

        if(
            error&&
            error.code===1
        ){

            alert(
                "Please allow location access to get your current location"
            );

        }else if(
            error&&
            error.code===2
        ){

            alert(
                "Unable to get your current location"
            );

        }else if(
            error&&
            error.code===3
        ){

            alert(
                "Location request timed out"
            );

        }else{

            alert(
                "Location not found"
            );
        }
    }
}


/* =========================================================
   CLEAR ROUTE
========================================================= */

function clearRoute(){

    stopNavigation(
        false
    );

    if(sourceMarker){

        map.removeLayer(
            sourceMarker
        );

        sourceMarker=null;
    }

    if(destinationMarker){

        map.removeLayer(
            destinationMarker
        );

        destinationMarker=null;
    }

    alternateRoutesLayer.clearLayers();
    routeSegmentsLayer.clearLayers();

    source=null;
    destination=null;

    routeResults=[];
    routePolylines=[];

    userSelectedRoute=false;

    recommendedIndex=-1;
    fastestIndex=-1;
    selectedRoute=0;

    const routeInfo=
        document.getElementById(
            "routeInfo"
        );

    if(routeInfo){

        routeInfo.innerHTML=
            "Enter source and destination";
    }

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    if(routeSummary){

        routeSummary.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    routeSummaryMinimized=false;

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(restoreButton){

        restoreButton.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    const detailsModal=
        document.getElementById(
            "detailsModal"
        );

    if(detailsModal){

        detailsModal.style.display=
            "none";
    }

    if(
        window.innerWidth<=800&&
        typeof openMobileSidebar==="function"
    ){

        openMobileSidebar();
    }
}


/* =========================================================
   HEALTH ADVICE
========================================================= */

function getHealthAdvice(
    category
){

    switch(category){

        case"Good":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Air quality is excellent. "+
                "Safe for everyone."
            );

        case"Satisfactory":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Air quality is acceptable. "+
                "Normal outdoor activities."
            );

        case"Moderate":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Sensitive groups should reduce "+
                "prolonged outdoor activity. "+
                "N95 mask recommended."
            );

        case"Poor":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Reduce outdoor exposure. "+
                "N95 mask recommended."
            );

        case"Very Poor":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Avoid outdoor exercise. "+
                "Stay indoors whenever possible."
            );

        case"Severe":

            return(
                "<hr>"+
                "<b>Health Advisory</b><br>"+
                "Hazardous air quality. "+
                "Avoid going outdoors."
            );

        default:

            return"";
    }
}


/* =========================================================
   ROUTE CARDS
========================================================= */

function renderRouteCards(){

    const routeInfo=
        document.getElementById(
            "routeInfo"
        );

    if(!routeInfo){

        return;
    }

    let html="";

    routeResults.forEach(
        function(route,index){

            let badge=
                "Alternative Route";

            let badgeColor=
                "#757575";

            if(
                index===recommendedIndex
            ){

                badge=
                    "Recommended";

                badgeColor=
                    "#2E7D32";

            }else if(
                index===fastestIndex
            ){

                badge=
                    "Fastest";

                badgeColor=
                    "#1565C0";
            }

            const aqiValue=
                Number(
                    route.averageAQI
                );

            const safeAQI=
                Number.isFinite(
                    aqiValue
                )
                ?
                    aqiValue
                :
                    0;

            const aqiColor=
                getAQIColor(
                    safeAQI
                );

            const aqiText=
                getAQICategory(
                    safeAQI
                );

            const isActive=
                selectedRoute===index;

            html+=`

<div
class="routeOption ${
isActive
?"activeRoute"
:""
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
Number(route.exposure)||0
)}
</div>

</div>

`;
        }
    );

    routeInfo.innerHTML=
        html;

    const closeModal=
        document.getElementById(
            "closeModal"
        );

    if(closeModal){

        closeModal.onclick=
            function(){

                const modal=
                    document.getElementById(
                        "detailsModal"
                    );

                if(modal){

                    modal.style.display=
                        "none";
                }
            };
    }
}


/* =========================================================
   MODAL CLOSE
========================================================= */

window.addEventListener(
    "click",
    function(event){

        const modal=
            document.getElementById(
                "detailsModal"
            );

        if(
            modal&&
            event.target===modal
        ){

            modal.style.display=
                "none";
        }
    }
);



/* =========================================================
   SATELLITE MAP VIEW
========================================================= */

let satelliteLayer=null;
let satelliteLabelsLayer=null;
let satelliteModeActive=false;
let satelliteControl=null;

function initializeSatelliteMap(){

    if(
        typeof map==="undefined"||
        !map||
        satelliteControl
    ){

        return;
    }

    satelliteLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom:19,
                attribution:"Tiles © Esri"
            }
        );

    satelliteLabelsLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom:19,
                opacity:.95,
                attribution:"Labels © Esri"
            }
        );

    satelliteControl=
        document.createElement("button");

    satelliteControl.id=
        "satelliteMapControl";

    satelliteControl.type=
        "button";

    satelliteControl.innerHTML=
        "🛰️";

    satelliteControl.title=
        "Satellite view";

    satelliteControl.setAttribute(
        "aria-label",
        "Toggle satellite map"
    );

    satelliteControl.style.cssText=`
        position:fixed;
        top:80px;
        right:14px;
        z-index:4500;
        width:42px;
        height:42px;
        padding:0;
        border:1px solid rgba(59,130,246,.55);
        border-radius:10px;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        box-shadow:0 5px 18px rgba(0,0,0,.35);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
    `;

    satelliteControl.addEventListener(
        "click",
        function(event){

            event.preventDefault();
            event.stopPropagation();

            toggleSatelliteMap();
        }
    );

    document.body.appendChild(
        satelliteControl
    );

    positionSatelliteControl();

    window.addEventListener(
        "resize",
        positionSatelliteControl
    );
}


function positionSatelliteControl(){

    if(!satelliteControl){

        return;
    }

    const recenterButton=
        document.getElementById(
            "recenterMapBtn"
        );

    if(recenterButton){

        const rect=
            recenterButton.getBoundingClientRect();

        satelliteControl.style.top=
            Math.max(
                10,
                rect.top-50
            )+"px";

    }else{

        const layersControl=
            document.querySelector(
                ".leaflet-control-layers"
            );

        if(layersControl){

            const rect=
                layersControl.getBoundingClientRect();

            satelliteControl.style.top=
                Math.max(
                    10,
                    rect.top
                )+"px";

        }else{

            satelliteControl.style.top=
                "80px";
        }
    }
}


function toggleSatelliteMap(){

    if(
        !map||
        !satelliteLayer||
        !satelliteLabelsLayer
    ){

        return;
    }

    if(!satelliteModeActive){

        satelliteLayer.addTo(map);
        satelliteLabelsLayer.addTo(map);

        satelliteModeActive=true;

        if(satelliteControl){

            satelliteControl.innerHTML=
                "🗺️";

            satelliteControl.title=
                "Normal map view";
        }

    }else{

        if(map.hasLayer(satelliteLabelsLayer)){

            map.removeLayer(
                satelliteLabelsLayer
            );
        }

        if(map.hasLayer(satelliteLayer)){

            map.removeLayer(
                satelliteLayer
            );
        }

        satelliteModeActive=false;

        satelliteControl.innerHTML=
            "🛰️";

        satelliteControl.title=
            "Satellite view";
    }

    map.invalidateSize();
}


/* =========================================================
   MOBILE MAP ROTATION
========================================================= */

let mapRotationWrapper=null;
let mapRotationAngle=0;
let mapRotationStartAngle=0;
let mapRotationStartRotation=0;
let mapRotationActive=false;


function getTwoFingerAngle(
    touch1,
    touch2
){

    const dx=
        touch2.clientX-
        touch1.clientX;

    const dy=
        touch2.clientY-
        touch1.clientY;

    return Math.atan2(
        dy,
        dx
    )*
    180/
    Math.PI;
}


function setupMobileMapRotation(){

    if(
        typeof map==="undefined"||
        !map||
        mapRotationWrapper
    ){

        return;
    }

    const mapContainer=
        map.getContainer();

    const mapPane=
        map.getPane(
            "mapPane"
        );

    if(
        !mapContainer||
        !mapPane||
        !mapPane.parentNode
    ){

        return;
    }


    /*
       Wrapper rotates the map while Leaflet
       remains responsible for pan and pinch zoom.
    */

    mapRotationWrapper=
        document.createElement(
            "div"
        );

    mapRotationWrapper.className=
        "leaflet-map-rotation-wrapper";

    mapRotationWrapper.style.position=
        "absolute";

    mapRotationWrapper.style.left=
        "0";

    mapRotationWrapper.style.top=
        "0";

    mapRotationWrapper.style.width=
        "100%";

    mapRotationWrapper.style.height=
        "100%";

    mapRotationWrapper.style.transformOrigin=
        "50% 50%";

    mapRotationWrapper.style.pointerEvents=
        "none";


    const parent=
        mapPane.parentNode;

    parent.insertBefore(
        mapRotationWrapper,
        mapPane
    );

    mapRotationWrapper.appendChild(
        mapPane
    );


    /*
       Two-finger rotation.
       Leaflet's normal two-finger pinch zoom
       is left enabled.
    */

    mapContainer.addEventListener(
        "touchstart",
        function(event){

            if(
                event.touches.length!==2
            ){

                return;
            }

            mapRotationActive=
                true;

            mapRotationStartAngle=
                getTwoFingerAngle(
                    event.touches[0],
                    event.touches[1]
                );

            mapRotationStartRotation=
                mapRotationAngle;

        },
        {
            passive:true
        }
    );


    mapContainer.addEventListener(
        "touchmove",
        function(event){

            if(
                !mapRotationActive||
                event.touches.length!==2||
                !mapRotationWrapper
            ){

                return;
            }

            const currentAngle=
                getTwoFingerAngle(
                    event.touches[0],
                    event.touches[1]
                );

            let delta=
                currentAngle-
                mapRotationStartAngle;

            if(delta>180){

                delta-=360;
            }

            if(delta<-180){

                delta+=360;
            }

            mapRotationAngle=
                mapRotationStartRotation+
                delta;

            mapRotationWrapper.style.transform=
                "rotate("+
                mapRotationAngle+
                "deg)";

        },
        {
            passive:true
        }
    );


    function endRotation(
        event
    ){

        if(
            event.touches.length<2
        ){

            mapRotationActive=
                false;
        }
    }


    mapContainer.addEventListener(
        "touchend",
        endRotation,
        {
            passive:true
        }
    );

    mapContainer.addEventListener(
        "touchcancel",
        endRotation,
        {
            passive:true
        }
    );


    /* =====================================================
       N BUTTON
       DIRECTLY BELOW RE-CENTER
    ===================================================== */

    if(
        window.innerWidth<=800&&
        !document.getElementById(
            "mapRotationResetButton"
        )
    ){

        const resetButton=
            document.createElement(
                "button"
            );

        resetButton.id=
            "mapRotationResetButton";

        resetButton.type=
            "button";

        resetButton.textContent=
            "N";

        resetButton.title=
            "Reset map to north-up";

        resetButton.setAttribute(
            "aria-label",
            "Reset map to north-up"
        );

        resetButton.style.cssText=`
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
        `;


        function positionNorthButton(){

            const recenterButton=
                document.getElementById(
                    "recenterMapBtn"
                );

            if(!recenterButton){

                return;
            }

            const rect=
                recenterButton.getBoundingClientRect();

            resetButton.style.top=
                (
                    rect.bottom+
                    8
                )+
                "px";
        }


        resetButton.addEventListener(
            "click",
            function(event){

                event.preventDefault();
                event.stopPropagation();

                mapRotationAngle=0;

                if(mapRotationWrapper){

                    mapRotationWrapper.style.transform=
                        "rotate(0deg)";
                }
            }
        );


        document.body.appendChild(
            resetButton
        );


        setTimeout(
            positionNorthButton,
            100
        );

        setTimeout(
            positionNorthButton,
            500
        );

        window.addEventListener(
            "resize",
            positionNorthButton
        );


        const recenterButton=
            document.getElementById(
                "recenterMapBtn"
            );

        if(recenterButton){

            const observer=
                new MutationObserver(
                    function(){

                        requestAnimationFrame(
                            positionNorthButton
                        );
                    }
                );

            observer.observe(
                recenterButton,
                {
                    attributes:true,
                    attributeFilter:[
                        "style"
                    ]
                }
            );
        }
    }
}


/* =========================================================
   INITIALIZATION
========================================================= */

injectRouteSummaryStyles();


if(
    document.readyState===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        function(){

            setupMobileMapRotation();
            initializeSatelliteMap();
        }
    );

}else{

    setupMobileMapRotation();
    initializeSatelliteMap();
}
