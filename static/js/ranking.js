/*
=========================================================
BENGALURU AQI NAVIGATOR
AIR QUALITY RANKING
=========================================================
*/

console.log("ranking.js loaded");


/* =========================================================
   RANKING STATION NAME MAPPING
   ========================================================= */

const rankingAreaNames = {

    "sanegurava_halli_bengaluru_device":
        "Sanegurava Halli",

    "hombegowda_nagar_bengaluru_device":
        "Hombegowda Nagar",

    "kasturi_nagar_bengaluru_device":
        "Kasturi Nagar",

    "bwssb_kadabesanahalli_bengaluru_device":
        "Kadabesanahalli",

    "shivapura_peenya_bengaluru_device":
        "Shivapura Peenya",

    "hebbal_bengaluru_device":
        "Hebbal",

    "jayanagar_bengaluru_device":
        "Jayanagar",

    "btm_layout_bengaluru_device":
        "BTM Layout",

    "marathahalli_bengaluru_device":
        "Marathahalli",

    "silk_board_bengaluru_device":
        "Silk Board",

    "hsr_layout_bengaluru_device":
        "HSR Layout",

    "kr_puram_bengaluru_device":
        "KR Puram",

    "rvce_device":
        "RVCE"

};


/* =========================================================
   FORMAT STATION NAME
   ========================================================= */

function formatRankingAreaName(device) {

    if (!device) {
        return "Unknown Area";
    }

    if (rankingAreaNames[device]) {
        return rankingAreaNames[device];
    }

    return String(device)
        .replace("_bengaluru_device", "")
        .replace("_device", "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, function(letter) {
            return letter.toUpperCase();
        });

}


/* =========================================================
   FORMAT AQI
   ========================================================= */

function formatRankingAQI(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return Math.round(number);

}


/* =========================================================
   AQI CATEGORY
   ========================================================= */

function getRankingAQICategory(aqi) {

    const value = Number(aqi);

    if (!Number.isFinite(value)) {
        return "Unknown";
    }

    if (value <= 50) {
        return "Good";
    }

    if (value <= 100) {
        return "Moderate";
    }

    if (value <= 200) {
        return "Poor";
    }

    if (value <= 300) {
        return "Unhealthy";
    }

    if (value <= 400) {
        return "Very Unhealthy";
    }

    return "Hazardous";

}


/* =========================================================
   AQI COLOR
   ========================================================= */

function getRankingAQIColor(aqi) {

    const value = Number(aqi);

    if (!Number.isFinite(value)) {
        return "#94a3b8";
    }

    if (value <= 50) {
        return "#00e400";
    }

    if (value <= 100) {
        return "#ffff00";
    }

    if (value <= 200) {
        return "#ff7e00";
    }

    if (value <= 300) {
        return "#ff0000";
    }

    if (value <= 400) {
        return "#8f3f97";
    }

    return "#7e0023";

}


/* =========================================================
   AQI TEXT COLOR
   ========================================================= */

function getRankingAQITextColor(aqi) {

    const value = Number(aqi);

    if (!Number.isFinite(value)) {
        return "#ffffff";
    }

    if (value > 50 && value <= 100) {
        return "#111827";
    }

    return "#ffffff";

}


/* =========================================================
   RANKING STYLES
   ========================================================= */

function injectRankingStyles() {

    const oldStyle =
        document.getElementById("professionalRankingStyles");

    if (oldStyle) {
        oldStyle.remove();
    }

    const style = document.createElement("style");

    style.id = "professionalRankingStyles";

    style.textContent = `

        /* =====================================================
           MAIN
           ===================================================== */

        #rankingContent {
            width: 100%;
            box-sizing: border-box;
        }

        .ranking-main {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 18px;
            box-sizing: border-box;
        }


        /* =====================================================
           SECTION
           ===================================================== */

        .ranking-section {
            width: 100%;
            box-sizing: border-box;

            border-radius: 17px;

            padding: 16px;

            overflow: hidden;

            background:
                rgba(255,255,255,0.035);

            border:
                1px solid
                rgba(255,255,255,0.10);

            box-shadow:
                0 8px 25px
                rgba(0,0,0,0.08);
        }

        .ranking-section.clean-section {
            border-top:
                3px solid #00e400;
        }

        .ranking-section.polluted-section {
            border-top:
                3px solid #ff3030;
        }


        /* =====================================================
           SECTION HEADER
           ===================================================== */

        .ranking-section-header {
            display: flex;
            align-items: center;

            gap: 11px;

            width: 100%;

            margin-bottom: 14px;

            box-sizing: border-box;
        }

        .ranking-indicator {
            width: 8px;
            min-width: 8px;

            height: 38px;

            border-radius: 8px;
        }

        .clean-indicator {
            background:
                linear-gradient(
                    to bottom,
                    #00e400,
                    #00c800
                );

            box-shadow:
                0 0 10px
                rgba(0,228,0,0.20);
        }

        .polluted-indicator {
            background:
                linear-gradient(
                    to bottom,
                    #ff3030,
                    #e60000
                );

            box-shadow:
                0 0 10px
                rgba(255,48,48,0.20);
        }

        .ranking-section-heading {
            min-width: 0;
            flex: 1;
        }

        .ranking-section-title {
            font-size: 17px;
            line-height: 1.2;

            font-weight: 800;

            letter-spacing: -0.2px;
        }

        .ranking-section-subtitle {
            margin-top: 3px;

            font-size: 11px;
            line-height: 1.3;

            font-weight: 500;
        }


        /* =====================================================
           RANKING LIST
           ===================================================== */

        .ranking-list {
            width: 100%;

            display: flex;
            flex-direction: column;

            gap: 9px;
        }


        /* =====================================================
           RANKING ROW
           ===================================================== */

        .ranking-row {
            width: 100%;

            min-height: 64px;

            display: flex;
            align-items: center;

            gap: 10px;

            padding: 9px 10px;

            box-sizing: border-box;

            border-radius: 12px;

            transition:
                transform .18s ease,
                box-shadow .18s ease,
                border-color .18s ease;
        }

        .ranking-row:hover {
            transform: translateY(-1px);
        }


        /* =====================================================
           POSITION
           ===================================================== */

        .ranking-position {
            width: 35px;
            min-width: 35px;

            height: 35px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 10px;

            box-sizing: border-box;

            font-size: 13px;
            font-weight: 800;
        }

        .rank-first .ranking-position {
            color: #a16207;

            background:
                rgba(255,215,0,0.12);

            border:
                1px solid
                rgba(161,98,7,0.20);
        }

        .rank-second .ranking-position {
            color: #64748b;

            background:
                rgba(148,163,184,0.13);

            border:
                1px solid
                rgba(100,116,139,0.20);
        }

        .rank-third .ranking-position {
            color: #a0522d;

            background:
                rgba(205,127,50,0.11);

            border:
                1px solid
                rgba(160,82,45,0.20);
        }


        /* =====================================================
           STATION NAME
           ===================================================== */

        .ranking-name {
            min-width: 0;
            flex: 1;

            overflow: hidden;
        }

        .ranking-station-name {
            width: 100%;

            font-size: 13px;
            line-height: 1.3;

            font-weight: 750;

            white-space: nowrap;

            overflow: hidden;

            text-overflow: ellipsis;
        }

        .ranking-category {
            display: block;

            margin-top: 3px;

            font-size: 10px;
            line-height: 1.2;

            font-weight: 500;
        }


        /* =====================================================
           AQI VALUE
           ===================================================== */

        .ranking-aqi {
            min-width: 51px;

            height: 37px;

            padding: 0 8px;

            display: flex;
            align-items: center;
            justify-content: center;

            box-sizing: border-box;

            border-radius: 10px;

            font-size: 15px;
            font-weight: 850;

            background:
                var(--ranking-aqi-color);

            color:
                var(
                    --ranking-aqi-text-color,
                    #ffffff
                );

            box-shadow:
                0 4px 10px
                rgba(0,0,0,0.15);
        }


        /* =====================================================
           DIVIDER
           ===================================================== */

        .ranking-divider {
            width: 100%;
            height: 1px;

            background:
                rgba(148,163,184,0.08);
        }


        /* =====================================================
           EMPTY
           ===================================================== */

        .ranking-empty {
            width: 100%;

            min-height: 70px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 11px;

            font-size: 12px;

            text-align: center;
        }


        /* =====================================================
           LOADING
           ===================================================== */

        .ranking-loading {
            width: 100%;

            min-height: 180px;

            display: flex;
            flex-direction: column;

            align-items: center;
            justify-content: center;

            gap: 12px;

            font-size: 13px;
        }

        .ranking-loading-spinner {
            width: 28px;
            height: 28px;

            border:
                3px solid
                rgba(148,163,184,0.20);

            border-top-color:
                #2478e5;

            border-radius: 50%;

            animation:
                rankingSpinner
                .8s linear infinite;
        }

        @keyframes rankingSpinner {

            from {
                transform: rotate(0deg);
            }

            to {
                transform: rotate(360deg);
            }

        }


        /* =====================================================
           ERROR
           ===================================================== */

        .ranking-error {
            width: 100%;

            min-height: 150px;

            display: flex;
            flex-direction: column;

            align-items: center;
            justify-content: center;

            text-align: center;

            box-sizing: border-box;

            padding: 20px;

            border-radius: 14px;
        }

        .ranking-error-title {
            font-size: 15px;
            font-weight: 750;

            margin-bottom: 5px;
        }

        .ranking-error-text {
            font-size: 12px;
        }


        /* =====================================================
           LIGHT MODE
           ===================================================== */

        body:not(.dark) .ranking-section {

            background:
                rgba(255,255,255,0.78) !important;

            border-color:
                rgba(255,255,255,0.90) !important;

            box-shadow:
                0 8px 25px
                rgba(120,70,20,0.10) !important;
        }

        body:not(.dark) .ranking-section-title {

            color:
                #263746 !important;
        }

        body:not(.dark) .ranking-section-subtitle {

            color:
                #64748b !important;
        }

        body:not(.dark) .ranking-row {

            background:
                rgba(255,255,255,0.92) !important;

            border:
                1px solid
                rgba(148,163,184,0.18) !important;

            box-shadow:
                0 3px 10px
                rgba(15,23,42,0.07) !important;
        }

        body:not(.dark) .ranking-row:hover {

            background:
                rgba(255,255,255,0.98) !important;

            box-shadow:
                0 5px 14px
                rgba(15,23,42,0.10) !important;
        }

        body:not(.dark) .ranking-station-name {

            color:
                #263746 !important;
        }

        body:not(.dark) .ranking-category {

            color:
                #64748b !important;
        }

        body:not(.dark) .ranking-empty {

            color:
                #64748b !important;
        }

        body:not(.dark) .ranking-loading {

            color:
                #64748b !important;
        }

        body:not(.dark) .ranking-error {

            background:
                rgba(255,255,255,0.70) !important;

            border:
                1px solid
                rgba(148,163,184,0.18) !important;
        }

        body:not(.dark) .ranking-error-title {

            color:
                #263746 !important;
        }

        body:not(.dark) .ranking-error-text {

            color:
                #64748b !important;
        }


        /* =====================================================
           DARK MODE
           ===================================================== */

        body.dark .ranking-section {

            background:
                rgba(255,255,255,0.035) !important;

            border-color:
                rgba(255,255,255,0.08) !important;
        }

        body.dark .ranking-section-title {

            color:
                #f8fafc !important;
        }

        body.dark .ranking-section-subtitle {

            color:
                #94a3b8 !important;
        }

        body.dark .ranking-row {

            background:
                rgba(15,23,42,0.78) !important;

            border:
                1px solid
                rgba(148,163,184,0.12) !important;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.18) !important;
        }

        body.dark .ranking-station-name {

            color:
                #f1f5f9 !important;
        }

        body.dark .ranking-category {

            color:
                #94a3b8 !important;
        }

        body.dark .ranking-empty {

            color:
                #94a3b8 !important;
        }

        body.dark .ranking-loading {

            color:
                #94a3b8 !important;
        }

        body.dark .ranking-error {

            background:
                rgba(15,23,42,0.60) !important;
        }

        body.dark .ranking-error-title {

            color:
                #f1f5f9 !important;
        }

        body.dark .ranking-error-text {

            color:
                #94a3b8 !important;
        }


        /* =====================================================
           MOBILE
           ===================================================== */

        @media (max-width:800px) {

            .ranking-main {
                gap:14px;
            }

            .ranking-section {
                padding:14px;
                border-radius:15px;
            }

            .ranking-section-header {
                gap:10px;
                margin-bottom:13px;
            }

            .ranking-indicator {
                width:8px;
                min-width:8px;
                height:38px;
            }

            .ranking-section-title {
                font-size:16px;
            }

            .ranking-section-subtitle {
                font-size:11px;
            }

            .ranking-list {
                gap:8px;
            }

            .ranking-row {
                min-height:64px;
                padding:9px;
                gap:9px;
                border-radius:12px;
            }

            .ranking-position {
                width:35px;
                min-width:35px;
                height:35px;
            }

            .ranking-station-name {
                font-size:13px;
            }

            .ranking-category {
                font-size:10px;
            }

            .ranking-aqi {
                min-width:52px;
                height:38px;
                font-size:15px;
            }

        }


        @media (max-width:380px) {

            .ranking-section {
                padding:12px;
            }

            .ranking-row {
                padding:8px;
                gap:8px;
            }

            .ranking-position {
                width:32px;
                min-width:32px;
                height:32px;
            }

            .ranking-aqi {
                min-width:48px;
                height:36px;
                font-size:14px;
            }

            .ranking-station-name {
                font-size:12px;
            }

            .ranking-category {
                font-size:9px;
            }

        }

    `;

    document.head.appendChild(style);

}


/* =========================================================
   CREATE RANKING ROW
   ========================================================= */

function createRankingRow(point, index, type) {

    const stationName =
        formatRankingAreaName(point.device);

    const aqi =
        formatRankingAQI(point.aqi);

    const category =
        getRankingAQICategory(point.aqi);

    const aqiColor =
        getRankingAQIColor(point.aqi);

    const aqiTextColor =
        getRankingAQITextColor(point.aqi);

    let positionClass = "";

    if (index === 0) {
        positionClass = "rank-first";
    }

    else if (index === 1) {
        positionClass = "rank-second";
    }

    else if (index === 2) {
        positionClass = "rank-third";
    }

    return `

        <div class="ranking-row ${positionClass}">

            <div class="ranking-position">
                ${index + 1}
            </div>

            <div class="ranking-name">

                <div
                    class="ranking-station-name"
                    title="${stationName}"
                >
                    ${stationName}
                </div>

                <div class="ranking-category">
                    ${category}
                </div>

            </div>

            <div
                class="ranking-aqi"
                style="
                    --ranking-aqi-color:${aqiColor};
                    --ranking-aqi-text-color:${aqiTextColor};
                "
            >
                ${aqi}
            </div>

        </div>

    `;

}


/* =========================================================
   CREATE RANKING SECTION
   ========================================================= */

function createRankingSection(data, type) {

    const list =
        Array.isArray(data)
            ? data.slice(0, 3)
            : [];

    const isClean =
        type === "clean";

    const title =
        isClean
            ? "Top Clean Areas"
            : "Top Polluted Areas";

    const subtitle =
        isClean
            ? "Lowest recorded AQI"
            : "Highest recorded AQI";

    const indicatorClass =
        isClean
            ? "clean-indicator"
            : "polluted-indicator";

    let rows = "";

    if (list.length === 0) {

        rows = `

            <div class="ranking-empty">
                No ranking data available
            </div>

        `;

    }

    else {

        list.forEach(function(point, index) {

            rows += createRankingRow(
                point,
                index,
                type
            );

        });

    }

    return `

        <section
            class="ranking-section ${type}-section"
        >

            <div class="ranking-section-header">

                <div
                    class="ranking-indicator ${indicatorClass}"
                ></div>

                <div class="ranking-section-heading">

                    <div class="ranking-section-title">
                        ${title}
                    </div>

                    <div class="ranking-section-subtitle">
                        ${subtitle}
                    </div>

                </div>

            </div>

            <div class="ranking-list">
                ${rows}
            </div>

        </section>

    `;

}


/* =========================================================
   RENDER COMPLETE RANKING
   ========================================================= */

function renderRanking(data) {

    const container =
        document.getElementById(
            "rankingContent"
        );

    if (!container) {

        console.error(
            "rankingContent element not found."
        );

        return;
    }

    const clean =
        Array.isArray(data.clean)
            ? data.clean
            : [];

    const polluted =
        Array.isArray(data.polluted)
            ? data.polluted
            : [];

    container.innerHTML = `

        <div class="ranking-main">

            ${createRankingSection(
                clean,
                "clean"
            )}

            <div class="ranking-divider"></div>

            ${createRankingSection(
                polluted,
                "polluted"
            )}

        </div>

    `;

}


/* =========================================================
   LOADING STATE
   ========================================================= */

function showRankingLoading() {

    const container =
        document.getElementById(
            "rankingContent"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `

        <div class="ranking-loading">

            <div class="ranking-loading-spinner"></div>

            <span>
                Loading air quality ranking...
            </span>

        </div>

    `;

}


/* =========================================================
   ERROR STATE
   ========================================================= */

function showRankingError(error) {

    const container =
        document.getElementById(
            "rankingContent"
        );

    if (!container) {
        return;
    }

    console.error(
        "Ranking loading error:",
        error
    );

    container.innerHTML = `

        <div class="ranking-error">

            <div class="ranking-error-title">
                Unable to load ranking
            </div>

            <div class="ranking-error-text">
                Please try again.
            </div>

        </div>

    `;

}


/* =========================================================
   LOAD RANKING DATA
   ========================================================= */

async function loadRanking() {

    console.log(
        "Loading AQI ranking..."
    );

    showRankingLoading();

    try {

        const response =
            await fetch(
                "/ranking",
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Ranking API returned HTTP " +
                response.status
            );

        }

        const data =
            await response.json();

        console.log(
            "AQI ranking data:",
            data
        );

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "Invalid ranking response."
            );

        }

        renderRanking(data);

    }

    catch (error) {

        showRankingError(error);

    }

}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeRanking() {

    console.log(
        "Initializing ranking..."
    );

    injectRankingStyles();

    loadRanking();

}


/* =========================================================
   PAGE LOAD
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeRanking
    );

}

else {

    initializeRanking();

}


/* =========================================================
   REFRESH FUNCTION
   ========================================================= */

window.refreshRanking = function() {

    injectRankingStyles();

    loadRanking();

};