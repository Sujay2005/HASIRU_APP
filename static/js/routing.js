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
   VOICE NAVIGATION STATE
========================================================= */

const NAVIGATION_VOICE_ENABLED=true;
const NAVIGATION_VOICE_LANGUAGE="en-IN";

const NAVIGATION_VOICE_LEAD_DISTANCES=[
    500,
    200,
    50
];

let navigationVoiceSteps=[];
let navigationVoiceStepIndex=0;
let navigationVoiceAnnounced={};
let navigationVoiceLastPosition=null;
let navigationVoiceReady=false;
let navigationVoiceLastSpokenTime=0;


/* =========================================================
   SATELLITE MAP STATE
========================================================= */

let satelliteLayer=null;
let satelliteLabelsLayer=null;
let satelliteModeActive=false;
let satelliteControl=null;


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

function navigationSpeak(text){

    if(
        !NAVIGATION_VOICE_ENABLED||
        !("speechSynthesis" in window)||
        !text
    ){

        return;
    }

    try{

        window.speechSynthesis.cancel();

        const utterance=
            new SpeechSynthesisUtterance(
                text
            );

        utterance.lang=
            NAVIGATION_VOICE_LANGUAGE;

        utterance.rate=.95;
        utterance.pitch=1;
        utterance.volume=1;

        navigationVoiceLastSpokenTime=
            Date.now();

        window.speechSynthesis.speak(
            utterance
        );

    }catch(error){

        console.warn(
            "Navigation voice error:",
            error
        );
    }
}


function formatNavigationDistance(
    meters
){

    meters=Number(meters);

    if(!Number.isFinite(meters)){
        return "";
    }

    if(meters>=1000){

        const km=
            meters/1000;

        if(km>=10){

            return Math.round(km)+" kilometres";
        }

        return km.toFixed(1)+
            " kilometres";
    }

    if(meters>=100){

        return Math.round(
            meters/50
        )*50+
            " metres";
    }

    return Math.max(
        10,
        Math.round(
            meters/10
        )*10
    )+
        " metres";
}


function getNavigationInstruction(
    step
){

    if(
        !step||
        !step.maneuver
    ){

        return "Continue on the route";
    }

    const maneuver=
        step.maneuver;

    const type=
        String(
            maneuver.type||""
        ).toLowerCase();

    const modifier=
        String(
            maneuver.modifier||""
        ).toLowerCase();

    if(type==="arrive"){

        return "You have arrived at your destination";
    }

    if(type==="depart"){

        if(
            modifier==="left"
        ){

            return "Start by turning left";
        }

        if(
            modifier==="right"
        ){

            return "Start by turning right";
        }

        return "Start driving on the route";
    }

    if(
        type==="roundabout"||
        type==="rotary"
    ){

        const exitNumber=
            maneuver.exit;

        if(exitNumber){

            return "Enter the roundabout and take exit "+
                exitNumber;
        }

        return "Enter the roundabout";
    }

    if(type==="fork"){

        if(modifier.includes("left")){

            return "Keep left at the fork";
        }

        if(modifier.includes("right")){

            return "Keep right at the fork";
        }

        return "Keep straight at the fork";
    }

    if(type==="merge"){

        if(modifier.includes("left")){

            return "Merge left";
        }

        if(modifier.includes("right")){

            return "Merge right";
        }

        return "Merge onto the road";
    }

    if(
        type==="on ramp"||
        type==="on-ramp"
    ){

        if(modifier.includes("left")){

            return "Take the ramp on the left";
        }

        if(modifier.includes("right")){

            return "Take the ramp on the right";
        }

        return "Take the ramp";
    }

    if(
        type==="off ramp"||
        type==="off-ramp"
    ){

        if(modifier.includes("left")){

            return "Take the exit on the left";
        }

        if(modifier.includes("right")){

            return "Take the exit on the right";
        }

        return "Take the exit";
    }

    if(
        type==="uturn"||
        type==="u-turn"
    ){

        return "Make a U-turn";
    }

    if(type==="new name"){

        return "Continue onto the new road";
    }

    if(type==="notification"){

        return "Continue on the route";
    }

    if(
        modifier==="sharp left"
    ){

        return "Turn sharply left";
    }

    if(
        modifier==="sharp right"
    ){

        return "Turn sharply right";
    }

    if(
        modifier==="slight left"
    ){

        return "Keep slightly left";
    }

    if(
        modifier==="slight right"
    ){

        return "Keep slightly right";
    }

    if(
        modifier==="left"
    ){

        return "Turn left";
    }

    if(
        modifier==="right"
    ){

        return "Turn right";
    }

    if(
        modifier==="straight"
    ){

        return "Continue straight";
    }

    return "Continue on the route";
}


function buildNavigationVoiceSteps(
    route
){

    navigationVoiceSteps=[];
    navigationVoiceStepIndex=0;
    navigationVoiceAnnounced={};
    navigationVoiceReady=false;

    if(
        !route||
        !route.legs||
        !route.legs.length
    ){

        return;
    }

    const steps=[];

    route.legs.forEach(
        function(leg){

            if(
                !leg.steps||
                !leg.steps.length
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

                    steps.push({

                        lat:
                            Number(
                                location[1]
                            ),

                        lng:
                            Number(
                                location[0]
                            ),

                        distance:
                            Number(
                                step.distance||0
                            ),

                        instruction:
                            getNavigationInstruction(
                                step
                            ),

                        announced:{}
                    });
                }
            );
        }
    );

    navigationVoiceSteps=steps;
    navigationVoiceReady=
        navigationVoiceSteps.length>0;
}


function distanceToNavigationVoiceStep(
    position,
    step
){

    return getDistanceMeters(
        position.lat,
        position.lng,
        step.lat,
        step.lng
    );
}


function updateNavigationVoice(
    currentPosition
){

    if(
        !navigationActive||
        !navigationVoiceReady||
        !navigationVoiceSteps.length
    ){

        return;
    }

    navigationVoiceLastPosition=
        currentPosition;

    while(
        navigationVoiceStepIndex<
        navigationVoiceSteps.length
    ){

        const step=
            navigationVoiceSteps[
                navigationVoiceStepIndex
            ];

        const distance=
            distanceToNavigationVoiceStep(
                currentPosition,
                step
            );

        if(distance<=20){

            const arrive=
                step.instruction
                    .toLowerCase()
                    .includes(
                        "arrived"
                    );

            if(
                !navigationVoiceAnnounced[
                    navigationVoiceStepIndex+
                    "_turn"
                ]
            ){

                navigationSpeak(
                    step.instruction
                );

                navigationVoiceAnnounced[
                    navigationVoiceStepIndex+
                    "_turn"
                ]=true;
            }

            navigationVoiceStepIndex++;

            if(arrive){

                return;
            }

            continue;
        }

        for(
            let i=0;
            i<NAVIGATION_VOICE_LEAD_DISTANCES.length;
            i++
        ){

            const leadDistance=
                NAVIGATION_VOICE_LEAD_DISTANCES[i];

            if(
                distance<=leadDistance
            ){

                const key=
                    navigationVoiceStepIndex+
                    "_" +
                    leadDistance;

                if(
                    !navigationVoiceAnnounced[key]
                ){

                    navigationSpeak(
                        step.instruction+
                        " in "+
                        formatNavigationDistance(
                            distance
                        )
                    );

                    navigationVoiceAnnounced[key]=
                        true;
                }

                break;
            }
        }

        break;
    }
}


function resetNavigationVoice(){

    navigationVoiceSteps=[];
    navigationVoiceStepIndex=0;
    navigationVoiceAnnounced={};
    navigationVoiceLastPosition=null;
    navigationVoiceReady=false;

    if(
        "speechSynthesis" in window
    ){

        try{

            window.speechSynthesis.cancel();

        }catch(error){}
    }
}


function announceNavigationStart(){

    if(
        !navigationVoiceReady||
        !navigationVoiceSteps.length
    ){

        navigationSpeak(
            "Navigation started"
        );

        return;
    }

    navigationSpeak(
        "Navigation started. "+
        navigationVoiceSteps[0].instruction+
        " in "+
        formatNavigationDistance(
            navigationVoiceSteps[0].distance
        )
    );
}


/* =========================================================
   SATELLITE MAP
========================================================= */

function initializeSatelliteMap(){

    if(
        typeof map==="undefined"||
        !map
    ){

        return;
    }

    if(
        satelliteControl
    ){

        return;
    }

    satelliteLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom:19,
                attribution:
                    "Tiles © Esri"
            }
        );

    satelliteLabelsLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            {
                maxZoom:19,
                opacity:.9,
                attribution:
                    "Labels © Esri"
            }
        );

    satelliteControl=
        document.createElement(
            "button"
        );

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
        "Toggle satellite view"
    );

    satelliteControl.style.cssText=`
        position:fixed;
        top:85px;
        right:14px;
        z-index:4500;
        width:42px;
        height:42px;
        border:1px solid rgba(59,130,246,.55);
        border-radius:12px;
        background:rgba(5,15,30,.94);
        color:#fff;
        font-size:20px;
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
}


function positionSatelliteControl(){

    if(!satelliteControl){

        return;
    }

    const layersControl=
        document.querySelector(
            ".leaflet-control-layers"
        );

    if(layersControl){

        const rect=
            layersControl.getBoundingClientRect();

        satelliteControl.style.top=
            (rect.bottom+10)+"px";

        satelliteControl.style.right=
            "14px";
    }
}


function toggleSatelliteMap(){

    if(
        !map||
        !satelliteLayer
    ){

        return;
    }

    if(
        !satelliteModeActive
    ){

        satelliteLayer.addTo(map);

        if(
            satelliteLabelsLayer
        ){

            satelliteLabelsLayer.addTo(
                map
            );
        }

        satelliteModeActive=true;

        if(satelliteControl){

            satelliteControl.innerHTML=
                "🗺️";

            satelliteControl.title=
                "Map view";
        }

    }else{

        map.removeLayer(
            satelliteLayer
        );

        if(
            satelliteLabelsLayer&&
            map.hasLayer(
                satelliteLabelsLayer
            )
        ){

            map.removeLayer(
                satelliteLabelsLayer
            );
        }

        satelliteModeActive=false;

        if(satelliteControl){

            satelliteControl.innerHTML=
                "🛰️";

            satelliteControl.title=
                "Satellite view";
        }
    }

    map.invalidateSize();
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

        buildNavigationVoiceSteps(
            data.routes[0]
        );

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
        !navigationVoiceReady&&
        routeResults[selectedRoute].originalRoute
    ){

        buildNavigationVoiceSteps(
            routeResults[
                selectedRoute
            ].originalRoute
        );
    }

    announceNavigationStart();

    if(
        navigationWatchId!==null
    ){

        navigator.geolocation.clearWatch(
            navigationWatchId
        );
    }

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

        if(satelliteControl){

            satelliteControl.style.top=
                (rect.bottom+10)+"px";
        }
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
   ROUTE SUMMARY MINIMIZE
========================================================= */

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

    routeSummary.style.display=
        "none";

    if(restoreButton){

        restoreButton.style.display=
            "flex";
    }

    routeSummaryMinimized=true;
}


/* =========================================================
   ROUTE SUMMARY RESTORE
========================================================= */

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

    routeSummary.style.display=
        "block";

    if(restoreButton){

        restoreButton.style.display=
            "none";
    }

    routeSummaryMinimized=false;
}


/* =========================================================
   SHOW ROUTE SUMMARY
========================================================= */

function showRouteSummary(
    index
){

    setupRouteSummaryControls();

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    const summaryContent=
        document.getElementById(
            "summaryContent"
        );

    if(
        !routeSummary||
        !summaryContent||
        !routeResults[index]
    ){

        return;
    }

    const route=
        routeResults[index];

    const future=
        route.futureAQI||
        {};

    const averageAQI=
        Number(
            route.averageAQI
        );

    const maxAQI=
        Number(
            route.maxAQI
        );

    const exposure=
        Number(
            route.exposure
        );

    const futureAverage=
        Number(
            future.average_aqi
        );

    const category=
        route.category||
        getAQICategory(
            averageAQI
        );

    summaryContent.innerHTML=`

        <div class="summary-row">
            <span>Route</span>
            <b>
                Route ${route.routeNumber}
            </b>
        </div>

        <div class="summary-row">
            <span>Distance</span>
            <b>
                ${route.distance} km
            </b>
        </div>

        <div class="summary-row">
            <span>Travel time</span>
            <b>
                ${route.time} min
            </b>
        </div>

        <div class="summary-row">
            <span>Average AQI</span>
            <b>
                ${Number.isFinite(averageAQI)
                    ? averageAQI.toFixed(1)
                    : "—"}
            </b>
        </div>

        <div class="summary-row">
            <span>Maximum AQI</span>
            <b>
                ${Number.isFinite(maxAQI)
                    ? maxAQI.toFixed(1)
                    : "—"}
            </b>
        </div>

        <div class="summary-row">
            <span>Exposure</span>
            <b>
                ${Number.isFinite(exposure)
                    ? exposure.toFixed(1)
                    : "—"}
            </b>
        </div>

        <div class="summary-row">
            <span>Status</span>
            <b>
                ${category}
            </b>
        </div>

        <div class="summary-row">
            <span>Future AQI</span>
            <b>
                ${
                    Number.isFinite(
                        futureAverage
                    )
                    ?
                    futureAverage.toFixed(1)
                    :
                    "—"
                }
            </b>
        </div>

        <button
            id="detailsBtn"
            type="button"
        >
            View Route Details
        </button>
    `;

    const detailsButton=
        document.getElementById(
            "detailsBtn"
        );

    if(detailsButton){

        detailsButton.addEventListener(
            "click",
            function(){

                if(
                    typeof showRouteDetails===
                    "function"
                ){

                    showRouteDetails(
                        index
                    );

                }else{

                    alert(
                        "Route details are not available."
                    );
                }
            }
        );
    }

    routeSummary.style.display=
        "block";

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(restoreButton){

        restoreButton.style.display=
            "none";
    }

    routeSummaryMinimized=false;
}


/* =========================================================
   ROUTE DETAILS
========================================================= */

function showRouteDetails(
    index
){

    if(
        !routeResults[index]
    ){

        return;
    }

    const route=
        routeResults[index];

    const future=
        route.futureAQI||
        {};

    const averageAQI=
        Number(
            route.averageAQI
        );

    const maxAQI=
        Number(
            route.maxAQI
        );

    const exposure=
        Number(
            route.exposure
        );

    const futureAQI=
        Number(
            future.average_aqi
        );

    const details=
        [
            "Route "+route.routeNumber,

            "Distance: "+
            route.distance+
            " km",

            "Travel time: "+
            route.time+
            " min",

            "Average AQI: "+
            (
                Number.isFinite(
                    averageAQI
                )
                ?
                averageAQI.toFixed(1)
                :
                "Unavailable"
            ),

            "Maximum AQI: "+
            (
                Number.isFinite(
                    maxAQI
                )
                ?
                maxAQI.toFixed(1)
                :
                "Unavailable"
            ),

            "Exposure score: "+
            (
                Number.isFinite(
                    exposure
                )
                ?
                exposure.toFixed(1)
                :
                "Unavailable"
            ),

            "Current category: "+
            (
                route.category||
                getAQICategory(
                    averageAQI
                )
            ),

            "Future AQI: "+
            (
                Number.isFinite(
                    futureAQI
                )
                ?
                futureAQI.toFixed(1)
                :
                "Unavailable"
            )
        ];

    alert(
        details.join("\n")
    );
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

    routeInfo.innerHTML="";

    routeResults.forEach(
        function(route,index){

            const card=
                document.createElement(
                    "div"
                );

            card.className=
                "route-card";

            if(index===selectedRoute){

                card.classList.add(
                    "selected"
                );
            }

            const isRecommended=
                index===
                recommendedIndex;

            const isFastest=
                index===
                fastestIndex;

            card.innerHTML=`

                <div class="route-card-title">
                    Route ${route.routeNumber}

                    ${
                        isRecommended
                        ?
                        '<span class="route-badge">Recommended</span>'
                        :
                        ''
                    }

                    ${
                        isFastest
                        ?
                        '<span class="route-badge fastest">Fastest</span>'
                        :
                        ''
                    }
                </div>

                <div class="route-card-info">

                    <span>
                        ${route.distance} km
                    </span>

                    <span>
                        ${route.time} min
                    </span>

                </div>

                <div class="route-card-aqi">

                    <span>
                        AQI ${Number(
                            route.averageAQI
                        ).toFixed(1)}
                    </span>

                    <span>
                        ${route.category}
                    </span>

                </div>
            `;

            card.addEventListener(
                "click",
                function(){

                    selectRoute(
                        index
                    );
                }
            );

            routeInfo.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   ROUTE SEGMENTS
========================================================= */

async function loadRouteSegments(
    index
){

    if(
        !routeResults[index]
    ){

        return;
    }

    routeSegmentsLayer.clearLayers();

    const route=
        routeResults[index];

    if(
        !route.routeCoords||
        route.routeCoords.length<2
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
                                route.routeCoords
                        })
                }
            );

        if(
            !response.ok
        ){

            return;
        }

        const data=
            await response.json();

        if(
            !Array.isArray(data)
        ){

            return;
        }

        data.forEach(
            function(segment){

                if(
                    !segment||
                    !segment.coordinates
                ){

                    return;
                }

                const coordinates=
                    segment.coordinates;

                const color=
                    getAQIColor(
                        segment.aqi
                    );

                const polyline=
                    L.polyline(
                        coordinates,
                        {
                            color:color,
                            weight:7,
                            opacity:.85
                        }
                    );

                polyline.bindPopup(`
                    <b>AQI:</b>
                    ${
                        Number(
                            segment.aqi
                        ).toFixed(1)
                    }
                    <br>
                    <b>Status:</b>
                    ${
                        segment.category||
                        getAQICategory(
                            segment.aqi
                        )
                    }
                `);

                routeSegmentsLayer.addLayer(
                    polyline
                );
            }
        );

    }catch(error){

        console.warn(
            "Route segment loading failed:",
            error
        );
    }
}


/* =========================================================
   SOURCE / DESTINATION MARKERS
========================================================= */

function createSourceMarker(
    position
){

    if(sourceMarker){

        sourceMarker.setLatLng([
            position.lat,
            position.lng
        ]);

        return;
    }

    sourceMarker=
        L.marker([
            position.lat,
            position.lng
        ])
        .addTo(map)
        .bindPopup(
            "<b>Start</b>"
        );
}


function createDestinationMarker(
    position
){

    if(destinationMarker){

        destinationMarker.setLatLng([
            position.lat,
            position.lng
        ]);

        return;
    }

    destinationMarker=
        L.marker([
            position.lat,
            position.lng
        ])
        .addTo(map)
        .bindPopup(
            "<b>Destination</b>"
        );
}


/* =========================================================
   SET SOURCE
========================================================= */

function setSource(
    lat,
    lng
){

    source={
        lat:Number(lat),
        lng:Number(lng)
    };

    createSourceMarker(
        source
    );
}


/* =========================================================
   SET DESTINATION
========================================================= */

function setDestination(
    lat,
    lng
){

    destination={
        lat:Number(lat),
        lng:Number(lng)
    };

    createDestinationMarker(
        destination
    );
}


/* =========================================================
   CLEAR ROUTE
========================================================= */

function clearRoute(){

    routeSegmentsLayer.clearLayers();

    alternateRoutesLayer.clearLayers();

    routePolylines=[];

    routeResults=[];

    recommendedIndex=-1;

    fastestIndex=-1;

    selectedRoute=0;

    userSelectedRoute=false;

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

    if(navigationActive){

        stopNavigation(false);
    }

    source=null;
    destination=null;

    const routeInfo=
        document.getElementById(
            "routeInfo"
        );

    if(routeInfo){

        routeInfo.innerHTML="";
    }

    const routeSummary=
        document.getElementById(
            "routeSummary"
        );

    if(routeSummary){

        routeSummary.style.display=
            "none";
    }

    const restoreButton=
        document.getElementById(
            "routeSummaryRestoreBtn"
        );

    if(restoreButton){

        restoreButton.style.display=
            "none";
    }
}


/* =========================================================
   USE CURRENT LOCATION AS SOURCE
========================================================= */

function useCurrentLocation(){

    if(
        !navigator.geolocation
    ){

        alert(
            "Geolocation is not supported by this browser."
        );

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

            setSource(
                current.lat,
                current.lng
            );

            map.setView(
                [
                    current.lat,
                    current.lng
                ],
                16,
                {
                    animate:true
                }
            );

        },

        function(error){

            console.warn(
                "Current location error:",
                error
            );

            alert(
                "Unable to get your current location."
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
   ROUTE DISTANCE FORMAT
========================================================= */

function formatRouteDistance(
    distanceKm
){

    const value=
        Number(
            distanceKm
        );

    if(
        !Number.isFinite(value)
    ){

        return "—";
    }

    if(value<1){

        return Math.round(
            value*1000
        )+
        " m";
    }

    return value.toFixed(2)+
        " km";
}


/* =========================================================
   ROUTE TIME FORMAT
========================================================= */

function formatRouteTime(
    minutes
){

    const value=
        Number(
            minutes
        );

    if(
        !Number.isFinite(value)
    ){

        return "—";
    }

    if(value<1){

        return "<1 min";
    }

    const rounded=
        Math.round(value);

    if(
        rounded<60
    ){

        return rounded+
            " min";
    }

    const hours=
        Math.floor(
            rounded/60
        );

    const mins=
        rounded%60;

    if(mins===0){

        return hours+
            " hr";
    }

    return hours+
        " hr "+
        mins+
        " min";
}


/* =========================================================
   ROUTE AQI HELPERS
========================================================= */

function getRouteAQIValue(
    route
){

    if(!route){

        return 0;
    }

    const value=
        Number(
            route.averageAQI
        );

    return Number.isFinite(value)
        ?
        value
        :
        0;
}


/* =========================================================
   INITIALIZE ROUTING UI
========================================================= */

function initializeRoutingUI(){

    setupRouteSummaryControls();

    initializeRecenterButton();

    setTimeout(
        function(){

            initializeSatelliteMap();

            setupLayersRecenterPosition();

        },
        500
    );
}

/* =========================================================
   ROUTE AQI DISPLAY
========================================================= */

function updateRouteAQIDisplay(
    route
){

    if(!route){

        return;
    }

    const averageAQI=
        Number(
            route.averageAQI
        );

    const maxAQI=
        Number(
            route.maxAQI
        );

    const exposure=
        Number(
            route.exposure
        );

    const category=
        route.category||
        getAQICategory(
            averageAQI
        );

    const averageElement=
        document.getElementById(
            "averageAQI"
        );

    const maxElement=
        document.getElementById(
            "maxAQI"
        );

    const exposureElement=
        document.getElementById(
            "exposureScore"
        );

    const categoryElement=
        document.getElementById(
            "aqiCategory"
        );

    if(averageElement){

        averageElement.textContent=
            Number.isFinite(
                averageAQI
            )
            ?
            averageAQI.toFixed(1)
            :
            "0";
    }

    if(maxElement){

        maxElement.textContent=
            Number.isFinite(
                maxAQI
            )
            ?
            maxAQI.toFixed(1)
            :
            "0";
    }

    if(exposureElement){

        exposureElement.textContent=
            Number.isFinite(
                exposure
            )
            ?
            exposure.toFixed(1)
            :
            "0";
    }

    if(categoryElement){

        categoryElement.textContent=
            category;
    }
}


/* =========================================================
   FUTURE AQI DISPLAY
========================================================= */

function updateFutureAQIDisplay(
    futureAQI
){

    if(!futureAQI){

        return;
    }

    const value=
        Number(
            futureAQI.average_aqi
        );

    const element=
        document.getElementById(
            "futureAQI"
        );

    if(!element){

        return;
    }

    element.textContent=
        Number.isFinite(value)
        ?
        value.toFixed(1)
        :
        "0";
}


/* =========================================================
   ROUTE CARD STYLES
========================================================= */

function injectRouteCardStyles(){

    if(
        document.getElementById(
            "routeCardStyles"
        )
    ){

        return;
    }

    const style=
        document.createElement(
            "style"
        );

    style.id=
        "routeCardStyles";

    style.textContent=`

        .route-card{

            margin:8px 0;

            padding:12px;

            border-radius:12px;

            background:
                rgba(30,41,59,.75);

            border:
                1px solid
                rgba(148,163,184,.14);

            color:#e2e8f0;

            cursor:pointer;

            transition:
                transform .15s ease,
                border-color .15s ease,
                background .15s ease;
        }

        .route-card:hover{

            transform:
                translateY(-1px);

            border-color:
                rgba(59,130,246,.45);
        }

        .route-card.selected{

            border-color:
                rgba(59,130,246,.85);

            background:
                rgba(30,64,175,.28);
        }

        .route-card-title{

            display:flex;

            align-items:center;

            flex-wrap:wrap;

            gap:6px;

            font-size:13px;

            font-weight:750;

            margin-bottom:8px;
        }

        .route-card-info{

            display:flex;

            justify-content:space-between;

            gap:10px;

            margin-bottom:7px;

            font-size:12px;

            color:#cbd5e1;
        }

        .route-card-aqi{

            display:flex;

            justify-content:space-between;

            gap:10px;

            font-size:11px;

            color:#94a3b8;
        }

        .route-badge{

            display:inline-flex;

            align-items:center;

            padding:3px 7px;

            border-radius:999px;

            background:
                rgba(34,197,94,.16);

            color:#86efac;

            font-size:9px;

            font-weight:750;
        }

        .route-badge.fastest{

            background:
                rgba(59,130,246,.16);

            color:#93c5fd;
        }

    `;

    document.head.appendChild(
        style
    );
}


/* =========================================================
   ROUTE DATA VALIDATION
========================================================= */

function isValidRouteCoordinates(
    coords
){

    if(
        !Array.isArray(coords)||
        coords.length<2
    ){

        return false;
    }

    return coords.every(
        function(point){

            return(
                Array.isArray(point)&&
                point.length>=2&&
                Number.isFinite(
                    Number(point[0])
                )&&
                Number.isFinite(
                    Number(point[1])
                )
            );
        }
    );
}


/* =========================================================
   ROUTE BOUNDS
========================================================= */

function getRouteBounds(
    coords
){

    if(
        !isValidRouteCoordinates(
            coords
        )
    ){

        return null;
    }

    const bounds=
        L.latLngBounds([]);

    coords.forEach(
        function(point){

            bounds.extend([
                point[0],
                point[1]
            ]);
        }
    );

    return bounds;
}


/* =========================================================
   FIT ROUTE TO MAP
========================================================= */

function fitRouteToMap(
    coords
){

    const bounds=
        getRouteBounds(
            coords
        );

    if(
        !bounds||
        !bounds.isValid()
    ){

        return;
    }

    map.fitBounds(
        bounds,
        {
            padding:[
                30,
                30
            ]
        }
    );
}


/* =========================================================
   SELECT RECOMMENDED ROUTE
========================================================= */

function selectRecommendedRoute(){

    if(
        recommendedIndex<0||
        !routeResults[
            recommendedIndex
        ]
    ){

        return;
    }

    selectRoute(
        recommendedIndex
    );
}


/* =========================================================
   SELECT FASTEST ROUTE
========================================================= */

function selectFastestRoute(){

    if(
        fastestIndex<0||
        !routeResults[
            fastestIndex
        ]
    ){

        return;
    }

    selectRoute(
        fastestIndex
    );
}


/* =========================================================
   ROUTE DRAW HELPERS
========================================================= */

function clearRoutePolylines(){

    routePolylines.forEach(
        function(polyline){

            if(
                polyline&&
                map.hasLayer(
                    polyline
                )
            ){

                map.removeLayer(
                    polyline
                );
            }
        }
    );

    routePolylines=[];
}


/* =========================================================
   UPDATE SELECTED ROUTE
========================================================= */

function updateSelectedRoute(){

    routePolylines.forEach(
        function(polyline,index){

            if(!polyline){

                return;
            }

            if(
                index===
                selectedRoute
            ){

                polyline.setStyle({

                    weight:10,

                    opacity:1
                });

            }else{

                polyline.setStyle({

                    weight:5,

                    opacity:.65
                });
            }
        }
    );

    if(
        routeResults[
            selectedRoute
        ]
    ){

        updateRouteAQIDisplay(
            routeResults[
                selectedRoute
            ]
        );

        updateFutureAQIDisplay(
            routeResults[
                selectedRoute
            ].futureAQI
        );
    }
}


/* =========================================================
   ROUTE SELECTION — UPDATED
========================================================= */

function selectRoute(
    index
){

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

            if(
                !polyline
            ){

                return;
            }

            if(
                i===index
            ){

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

                polyline.setStyle({

                    weight:5,

                    opacity:.65
                });
            }
        }
    );

    renderRouteCards();

    showRouteSummary(
        index
    );

    loadRouteSegments(
        index
    );

    updateRouteAQIDisplay(
        routeResults[index]
    );

    updateFutureAQIDisplay(
        routeResults[index].futureAQI
    );

    if(
        routeResults[index].originalRoute
    ){

        buildNavigationVoiceSteps(
            routeResults[index]
                .originalRoute
        );
    }

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

        fitRouteToMap(
            routeResults[index]
                .routeCoords
        );
    }
}


/* =========================================================
   DRAW ROUTE — UPDATED WITH VOICE STEPS
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
            await fetch(
                url
            );

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

        clearRoutePolylines();

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
            function(
                route,
                index
            ){

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

                            opacity:.7
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

                        selectRoute(
                            index
                        );
                    }
                );
            }
        );

        const routePromises=
            routes.map(
                async function(
                    route,
                    index
                ){

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
                            route.duration/
                            60
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

                                aqiData=
                                    result;
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

                                futureAQI=
                                    result;
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
                                route.distance/
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


        /* =====================================================
           BUILD VOICE STEPS FROM ROUTE
        ===================================================== */

        if(
            routeResults.length>0
        ){

            buildNavigationVoiceSteps(
                routeResults[0]
                    .originalRoute
            );
        }


        /* =====================================================
           FIND RECOMMENDED + FASTEST
        ===================================================== */

        if(
            routeResults.length>0
        ){

            recommendedIndex=0;

            fastestIndex=0;

            routeResults.forEach(
                function(
                    route,
                    index
                ){

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
                        parseFloat(
                            route.time
                        )<
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


        /* =====================================================
           SELECT RECOMMENDED ROUTE
        ===================================================== */

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

            buildNavigationVoiceSteps(
                routeResults[
                    recommendedIndex
                ].originalRoute
            );

            showRouteSummary(
                recommendedIndex
            );

            updateRouteAQIDisplay(
                routeResults[
                    recommendedIndex
                ]
            );

            updateFutureAQIDisplay(
                routeResults[
                    recommendedIndex
                ].futureAQI
            );

            loadRouteSegments(
                recommendedIndex
            );
        }


        /* =====================================================
           FIT MAP
        ===================================================== */

        if(
            routePolylines.length>0
        ){

            const bounds=
                L.featureGroup(
                    routePolylines
                ).getBounds();

            if(
                bounds.isValid()
            ){

                map.fitBounds(
                    bounds,
                    {
                        padding:[
                            30,
                            30
                        ]
                    }
                );
            }
        }


        closeSidebarAfterRoute();


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
   START NAVIGATION FROM SELECTED ROUTE
========================================================= */

function startSelectedRouteNavigation(){

    if(
        !routeResults[
            selectedRoute
        ]
    ){

        return;
    }

    if(
        navigationActive
    ){

        stopNavigation(false);
    }

    const route=
        routeResults[
            selectedRoute
        ];

    if(
        !route.routeCoords||
        route.routeCoords.length<2
    ){

        return;
    }

    if(
        route.originalRoute
    ){

        buildNavigationVoiceSteps(
            route.originalRoute
        );
    }

    startNavigation();
}


/* =========================================================
   NAVIGATION BUTTON
========================================================= */

function createNavigationButton(){

    if(
        document.getElementById(
            "startNavigationBtn"
        )
    ){

        return;
    }

    const button=
        document.createElement(
            "button"
        );

    button.id=
        "startNavigationBtn";

    button.type=
        "button";

    button.textContent=
        "▶ Start Navigation";

    button.style.cssText=`

        position:fixed;

        left:50%;

        bottom:20px;

        transform:
            translateX(-50%);

        z-index:4500;

        min-width:180px;

        height:44px;

        padding:0 18px;

        border:0;

        border-radius:22px;

        background:
            #1976e8;

        color:#fff;

        font-size:13px;

        font-weight:750;

        cursor:pointer;

        box-shadow:
            0 8px 25px
            rgba(0,0,0,.35);

    `;

    button.addEventListener(
        "click",
        function(){

            startSelectedRouteNavigation();

        }
    );

    document.body.appendChild(
        button
    );
}


/* =========================================================
   NAVIGATION BUTTON STATE
========================================================= */

function updateNavigationButton(){

    const button=
        document.getElementById(
            "startNavigationBtn"
        );

    if(!button){

        return;
    }

    if(navigationActive){

        button.textContent=
            "■ Stop Navigation";

        button.style.background=
            "#dc2626";

    }else{

        button.textContent=
            "▶ Start Navigation";

        button.style.background=
            "#1976e8";
    }
}


/* =========================================================
   NAVIGATION BUTTON HANDLER
========================================================= */

function handleNavigationButton(){

    if(
        navigationActive
    ){

        stopNavigation(false);

    }else{

        startSelectedRouteNavigation();
    }

    updateNavigationButton();
}


/* =========================================================
   PATCH NAVIGATION STATE
========================================================= */

const originalStartNavigation=
    startNavigation;

const originalStopNavigation=
    stopNavigation;

            const routeDistance=
                Number(
                    route.distance
                );

            const routeTime=
                Number(
                    route.time
                );

            const routeAQI=
                Number(
                    route.averageAQI
                );

            html+=`
                <div
                    class="routeOption ${isActive ? "activeRoute" : ""}"
                    onclick="selectRoute(${index})"
                    style="cursor:pointer;"
                >

                    <div
                        class="routeBadge"
                        style="
                            background:${badgeColor};
                            color:#fff;
                            padding:4px 8px;
                            border-radius:8px;
                            display:inline-block;
                            font-size:10px;
                            font-weight:700;
                            margin-bottom:7px;
                        "
                    >
                        ${badge}
                    </div>

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:10px;
                        "
                    >

                        <div>

                            <div
                                style="
                                    font-size:14px;
                                    font-weight:700;
                                "
                            >
                                Route ${index+1}
                            </div>

                            <div
                                style="
                                    font-size:11px;
                                    opacity:.75;
                                    margin-top:3px;
                                "
                            >
                                ${
                                    Number.isFinite(
                                        routeDistance
                                    )
                                    ?
                                    routeDistance.toFixed(2)
                                    :
                                    "—"
                                }
                                km
                                ·
                                ${
                                    Number.isFinite(
                                        routeTime
                                    )
                                    ?
                                    routeTime.toFixed(1)
                                    :
                                    "—"
                                }
                                min
                            </div>

                        </div>

                        <div
                            style="
                                text-align:right;
                            "
                        >

                            <div
                                style="
                                    font-size:18px;
                                    font-weight:800;
                                    color:${aqiColor};
                                "
                            >
                                ${
                                    Number.isFinite(
                                        routeAQI
                                    )
                                    ?
                                    Math.round(
                                        routeAQI
                                    )
                                    :
                                    0
                                }
                            </div>

                            <div
                                style="
                                    font-size:9px;
                                    opacity:.75;
                                "
                            >
                                ${aqiText}
                            </div>

                        </div>

                    </div>

                </div>
            `;
        }
    );

    routeInfo.innerHTML=
        html;
}


/* =========================================================
   ROUTE SELECTION
========================================================= */

function selectRoute(
    index
){

    if(
        !routeResults[index]||
        !routePolylines[index]
    ){

        return;
    }

    userSelectedRoute=true;

    selectedRoute=index;

    routePolylines.forEach(
        function(
            polyline,
            i
        ){

            if(!polyline){

                return;
            }

            if(
                i===index
            ){

                polyline.setStyle({

                    weight:10,

                    opacity:1
                });

            }else{

                polyline.setStyle({

                    weight:5,

                    opacity:.65
                });
            }
        }
    );

    renderRouteCards();

    showRouteSummary(
        index
    );

    updateRouteAQIDisplay(
        routeResults[index]
    );

    updateFutureAQIDisplay(
        routeResults[index]
            .futureAQI
    );

    loadRouteSegments(
        index
    );


    /* =====================================================
       VOICE STEPS FOR SELECTED ROUTE
    ===================================================== */

    if(
        routeResults[index]
            .originalRoute
    ){

        buildNavigationVoiceSteps(
            routeResults[index]
                .originalRoute
        );
    }


    if(
        navigationActive
    ){

        if(
            routeResults[index]
                .routeCoords
        ){

            drawNavigationRoute(
                routeResults[index]
                    .routeCoords
            );
        }

    }else{

        fitRouteToMap(
            routeResults[index]
                .routeCoords
        );
    }
}


/* =========================================================
   MAP CLICK ROUTING
========================================================= */

let routeMapClickMode=
    null;


function enableSourceSelection(){

    routeMapClickMode=
        "source";

    if(
        typeof map!=="undefined"&&
        map
    ){

        map.getContainer()
            .style.cursor=
            "crosshair";
    }
}


function enableDestinationSelection(){

    routeMapClickMode=
        "destination";

    if(
        typeof map!=="undefined"&&
        map
    ){

        map.getContainer()
            .style.cursor=
            "crosshair";
    }
}


function disableMapClickRouting(){

    routeMapClickMode=
        null;

    if(
        typeof map!=="undefined"&&
        map
    ){

        map.getContainer()
            .style.cursor=
            "";
    }
}


if(
    typeof map!=="undefined"&&
    map
){

    map.on(
        "click",
        function(event){

            if(
                !routeMapClickMode
            ){

                return;
            }

            const lat=
                event.latlng.lat;

            const lng=
                event.latlng.lng;

            if(
                routeMapClickMode===
                "source"
            ){

                setSource(
                    lat,
                    lng
                );

            }else if(
                routeMapClickMode===
                "destination"
            ){

                setDestination(
                    lat,
                    lng
                );
            }

            disableMapClickRouting();
        }
    );
}


/* =========================================================
   GPS FOLLOW MODE
========================================================= */

function enableNavigationFollow(){

    if(
        navigationActive
    ){

        navigationFollowMode=
            true;
    }
}


function disableNavigationFollow(){

    navigationFollowMode=
        false;
}


/* =========================================================
   RECENTER NAVIGATION
========================================================= */

function recenterNavigation(){

    if(
        !navigationActive
    ){

        recenterMap();

        return;
    }

    navigationFollowMode=
        true;

    if(
        lastKnownNavigationPosition
    ){

        map.setView(
            [
                lastKnownNavigationPosition.lat,
                lastKnownNavigationPosition.lng
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
}


/* =========================================================
   SATELLITE CONTROL POSITION
========================================================= */

function updateSatelliteControlPosition(){

    if(
        !satelliteControl
    ){

        return;
    }

    const layers=
        document.querySelector(
            ".leaflet-control-layers"
        );

    const recenter=
        document.getElementById(
            "recenterMapBtn"
        );

    if(layers){

        const rect=
            layers.getBoundingClientRect();

        satelliteControl.style.top=
            (
                rect.bottom+
                10
            )+
            "px";
    }else if(recenter){

        const rect=
            recenter.getBoundingClientRect();

        satelliteControl.style.top=
            (
                rect.bottom+
                8
            )+
            "px";
    }
}


/* =========================================================
   SATELLITE MAP INITIALIZATION
========================================================= */

function initializeSatelliteMap(){

    if(
        typeof map==="undefined"||
        !map
    ){

        return;
    }

    if(
        satelliteControl
    ){

        return;
    }

    satelliteLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {

                maxZoom:19,

                attribution:
                    "Tiles © Esri"
            }
        );

    satelliteLabelsLayer=
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            {

                maxZoom:19,

                opacity:.9,

                attribution:
                    "Labels © Esri"
            }
        );


    satelliteControl=
        document.createElement(
            "button"
        );

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
        "Toggle satellite view"
    );

    satelliteControl.style.cssText=`

        position:fixed;

        top:85px;

        right:14px;

        z-index:4500;

        width:42px;

        height:42px;

        border:
            1px solid
            rgba(59,130,246,.55);

        border-radius:12px;

        background:
            rgba(5,15,30,.94);

        color:#fff;

        font-size:20px;

        cursor:pointer;

        box-shadow:
            0 5px 18px
            rgba(0,0,0,.35);

        backdrop-filter:
            blur(8px);

        -webkit-backdrop-filter:
            blur(8px);
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


    setTimeout(
        updateSatelliteControlPosition,
        300
    );

    window.addEventListener(
        "resize",
        updateSatelliteControlPosition
    );
}


/* =========================================================
   TOGGLE SATELLITE
========================================================= */

function toggleSatelliteMap(){

    if(
        typeof map==="undefined"||
        !map||
        !satelliteLayer
    ){

        return;
    }

    if(
        !satelliteModeActive
    ){

        satelliteLayer.addTo(
            map
        );

        if(
            satelliteLabelsLayer
        ){

            satelliteLabelsLayer.addTo(
                map
            );
        }

        satelliteModeActive=
            true;

        if(
            satelliteControl
        ){

            satelliteControl.innerHTML=
                "🗺️";

            satelliteControl.title=
                "Map view";
        }

    }else{

        if(
            map.hasLayer(
                satelliteLabelsLayer
            )
        ){

            map.removeLayer(
                satelliteLabelsLayer
            );
        }

        if(
            map.hasLayer(
                satelliteLayer
            )
        ){

            map.removeLayer(
                satelliteLayer
            );
        }

        satelliteModeActive=
            false;

        if(
            satelliteControl
        ){

            satelliteControl.innerHTML=
                "🛰️";

            satelliteControl.title=
                "Satellite view";
        }
    }

    map.invalidateSize();
}


/* =========================================================
   VOICE CONTROL BUTTON
========================================================= */

function createVoiceNavigationButton(){

    if(
        document.getElementById(
            "navigationVoiceBtn"
        )
    ){

        return;
    }

    const button=
        document.createElement(
            "button"
        );

    button.id=
        "navigationVoiceBtn";

    button.type=
        "button";

    button.innerHTML=
        "🔊";

    button.title=
        "Toggle voice navigation";

    button.style.cssText=`

        position:fixed;

        right:14px;

        bottom:75px;

        width:42px;

        height:42px;

        z-index:4500;

        border:
            1px solid
            rgba(59,130,246,.55);

        border-radius:12px;

        background:
            rgba(5,15,30,.94);

        color:#fff;

        font-size:19px;

        cursor:pointer;

        box-shadow:
            0 5px 18px
            rgba(0,0,0,.35);

        backdrop-filter:
            blur(8px);

        -webkit-backdrop-filter:
            blur(8px);
    `;


    button.addEventListener(
        "click",
        function(event){

            event.preventDefault();

            event.stopPropagation();

            if(
                "speechSynthesis" in window
            ){

                if(
                    window.speechSynthesis
                        .speaking
                ){

                    window.speechSynthesis.cancel();

                    button.innerHTML=
                        "🔇";

                }else{

                    navigationSpeak(
                        "Voice navigation enabled"
                    );

                    button.innerHTML=
                        "🔊";
                }
            }
        }
    );


    document.body.appendChild(
        button
    );
}


/* =========================================================
   NAVIGATION START/STOP BUTTON
========================================================= */

function createNavigationControl(){

    if(
        document.getElementById(
            "navigationControl"
        )
    ){

        return;
    }

    const button=
        document.createElement(
            "button"
        );

    button.id=
        "navigationControl";

    button.type=
        "button";

    button.innerHTML=
        "▶";

    button.title=
        "Start navigation";

    button.style.cssText=`

        position:fixed;

        right:14px;

        bottom:125px;

        width:42px;

        height:42px;

        z-index:4500;

        border:
            1px solid
            rgba(59,130,246,.55);

        border-radius:12px;

        background:
            rgba(5,15,30,.94);

        color:#fff;

        font-size:17px;

        cursor:pointer;

        box-shadow:
            0 5px 18px
            rgba(0,0,0,.35);

        backdrop-filter:
            blur(8px);

        -webkit-backdrop-filter:
            blur(8px);
    `;


    button.addEventListener(
        "click",
        function(event){

            event.preventDefault();

            event.stopPropagation();

            if(
                navigationActive
            ){

                stopNavigation(
                    false
                );

                button.innerHTML=
                    "▶";

                button.title=
                    "Start navigation";

            }else{

                startSelectedRouteNavigation();

                button.innerHTML=
                    "■";

                button.title=
                    "Stop navigation";
            }
        }
    );


    document.body.appendChild(
        button
    );
}


/* =========================================================
   NAVIGATION ARRIVAL
========================================================= */

function navigationArrived(){

    navigationSpeak(
        "You have arrived at your destination"
    );

    stopNavigation(
        true
    );
}


/* =========================================================
   NAVIGATION GPS ERROR HANDLER
========================================================= */

function handleNavigationGPSError(
    error
){

    if(!error){

        return;
    }

    console.warn(
        "Navigation GPS error:",
        error
    );

    if(
        error.code===1
    ){

        console.warn(
            "Location permission denied."
        );

    }else if(
        error.code===2
    ){

        console.warn(
            "Position unavailable."
        );

    }else if(
        error.code===3
    ){

        console.warn(
            "GPS request timed out."
        );
    }
}


/* =========================================================
   SAFE GPS WATCH
========================================================= */

function startNavigationGPS(){

    if(
        !navigator.geolocation
    ){

        alert(
            "Geolocation is not supported."
        );

        return;
    }

    if(
        navigationWatchId!==null
    ){

        navigator.geolocation.clearWatch(
            navigationWatchId
        );
    }

    navigationWatchId=
        navigator.geolocation.watchPosition(

            updateNavigationPosition,

            handleNavigationGPSError,

            {
                enableHighAccuracy:true,

                maximumAge:2000,

                timeout:10000
            }
        );
}


/* =========================================================
   NAVIGATION STATE UPDATE
========================================================= */

function updateNavigationControls(){

    const navigationButton=
        document.getElementById(
            "navigationControl"
        );

    if(
        !navigationButton
    ){

        return;
    }

    if(
        navigationActive
    ){

        navigationButton.innerHTML=
            "■";

        navigationButton.title=
            "Stop navigation";

    }else{

        navigationButton.innerHTML=
            "▶";

        navigationButton.title=
            "Start navigation";
    }
}


/* =========================================================
   PATCH NAVIGATION START
========================================================= */

const navigationStartOriginal=
    startNavigation;


/* =========================================================
   PATCH NAVIGATION STOP
========================================================= */

const navigationStopOriginal=
    stopNavigation;


/* =========================================================
   ROUTING INITIALIZATION
========================================================= */

function initializeRouting(){

    injectRouteCardStyles();

    initializeRecenterButton();

    initializeSatelliteMap();

    createVoiceNavigationButton();

    createNavigationControl();

    setupRouteSummaryControls();

    updateSatelliteControlPosition();

    setTimeout(
        function(){

            setupLayersRecenterPosition();

            updateSatelliteControlPosition();

        },
        500
    );
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
       Existing Leaflet map rotation.

       One-finger movement and normal Leaflet
       pinch zoom remain enabled.
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


    /* =====================================================
       TWO-FINGER ROTATION
    ===================================================== */

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
       NORTH BUTTON
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


function initializeRoutingFeatures(){

    /*
       Existing map rotation
    */

    setupMobileMapRotation();


    /*
       Satellite map
    */

    initializeSatelliteMap();


    /*
       Voice navigation button
    */

    createVoiceNavigationButton();


    /*
       Navigation control
    */

    createNavigationControl();


    /*
       Route summary controls
    */

    setupRouteSummaryControls();


    /*
       Position controls after Leaflet
       controls have been rendered.
    */

    setTimeout(
        function(){

            setupLayersRecenterPosition();

            updateSatelliteControlPosition();

        },
        500
    );
}


if(
    document.readyState===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        initializeRoutingFeatures
    );

}else{

    initializeRoutingFeatures();
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.startNavigation=
    startNavigation;

window.stopNavigation=
    stopNavigation;

window.recenterMap=
    recenterMap;

window.toggleSatelliteMap=
    toggleSatelliteMap;

window.findRoute=
    findRoute;

window.clearRoute=
    clearRoute;

window.selectRoute=
    selectRoute;

window.useCurrentLocation=
    useCurrentLocation;
