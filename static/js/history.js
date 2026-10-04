/* =========================================================
   AQI TRENDS
   ========================================================= */

let aqiTrendChart = null;

let currentTrendData = [];

let currentTrendStation = "";

let currentTrendPeriod = 7;


/* =========================================================
   AQI COLOURS
   EXACTLY MATCHES THE MAP LEGEND
   ========================================================= */

function getTrendAQIColor(aqi) {

    aqi = Number(aqi);

    if (!Number.isFinite(aqi)) {
        aqi = 0;
    }

    if (aqi <= 50) {
        return "#00e400";
    }

    if (aqi <= 100) {
        return "#ffff00";
    }

    if (aqi <= 200) {
        return "#ff7e00";
    }

    if (aqi <= 300) {
        return "#ff0000";
    }

    if (aqi <= 400) {
        return "#8f3f97";
    }

    return "#7e0023";
}


/* =========================================================
   AQI CATEGORY
   ========================================================= */

function getTrendAQICategory(aqi) {

    aqi = Number(aqi);

    if (!Number.isFinite(aqi)) {
        aqi = 0;
    }

    if (aqi <= 50) {
        return "Good";
    }

    if (aqi <= 100) {
        return "Satisfactory";
    }

    if (aqi <= 200) {
        return "Moderate";
    }

    if (aqi <= 300) {
        return "Poor";
    }

    if (aqi <= 400) {
        return "Very Poor";
    }

    return "Severe";
}


/* =========================================================
   AQI VALUE
   ========================================================= */

function getAQIValue(point) {

    let value =
        Number(point.aqi_calibrated);

    /*
       Fallbacks in case the backend uses another
       AQI field name.
    */

    if (!Number.isFinite(value)) {

        value =
            Number(point.aqi);
    }

    if (!Number.isFinite(value)) {

        value =
            Number(point.AQI);
    }

    if (!Number.isFinite(value)) {

        return null;
    }

    return value;
}


/* =========================================================
   SHOW TREND
   ========================================================= */

function showTrend(device) {

    if (!device) {
        return;
    }

    fetch(
        "/station_history/" +
        encodeURIComponent(device)
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                "HTTP error " +
                response.status
            );

        }

        return response.json();

    })

    .then(data => {

        if (!Array.isArray(data)) {

            throw new Error(
                "Invalid AQI history data"
            );

        }

        currentTrendStation =
            device;

        currentTrendData =
            data;

        populateTrendStation(
            device
        );

        updateTrendDashboard();

    })

    .catch(error => {

        console.error(
            "Unable to load AQI history:",
            error
        );

        alert(
            "Unable to load AQI history."
        );

    });
}


/* =========================================================
   LOAD TREND STATION
   ========================================================= */

function loadTrendStation(device) {

    if (!device) {
        return;
    }

    currentTrendStation =
        device;

    const select =
        document.getElementById(
            "trendStation"
        );

    if (select) {

        select.value =
            device;
    }

    const loading =
        document.getElementById(
            "trendLoading"
        );

    if (loading) {

        loading.style.display =
            "block";
    }

    fetch(
        "/station_history/" +
        encodeURIComponent(device)
    )

    .then(response => {

        if (!response.ok) {

            throw new Error(
                "HTTP error " +
                response.status
            );

        }

        return response.json();

    })

    .then(data => {

        if (!Array.isArray(data)) {

            throw new Error(
                "Invalid AQI history data"
            );

        }

        currentTrendData =
            data;

        updateTrendDashboard();

    })

    .catch(error => {

        console.error(
            "Trend loading error:",
            error
        );

        currentTrendData =
            [];

        clearTrendDashboard();

    })

    .finally(() => {

        if (loading) {

            loading.style.display =
                "none";
        }

    });
}


/* =========================================================
   POPULATE TREND STATION
   ========================================================= */

function populateTrendStation(device) {

    const select =
        document.getElementById(
            "trendStation"
        );

    if (!select) {
        return;
    }

    let option =
        Array.from(
            select.options
        ).find(
            item =>
                item.value === device
        );

    if (!option) {

        option =
            document.createElement(
                "option"
            );

        option.value =
            device;

        option.textContent =
            device;

        select.appendChild(
            option
        );
    }

    select.value =
        device;
}


/* =========================================================
   UPDATE DASHBOARD
   ========================================================= */

function updateTrendDashboard() {

    if (
        !currentTrendData ||
        !currentTrendData.length
    ) {

        clearTrendDashboard();

        return;
    }

    const sorted =
        [...currentTrendData]

        .filter(
            point =>
                getAQIValue(point) !== null
        )

        .sort(
            (a, b) =>
                new Date(
                    a.timestamp
                ) -
                new Date(
                    b.timestamp
                )
        );

    if (!sorted.length) {

        clearTrendDashboard();

        return;
    }

    currentTrendData =
        sorted;

    updateCurrentAQI(
        sorted
    );

    updateAverageAQI(
        sorted
    );

    updateTrendChart();

    updateBestWorst(
        sorted
    );

    updateTrendInsight(
        sorted
    );
}


/* =========================================================
   CURRENT AQI
   ========================================================= */

function updateCurrentAQI(data) {

    const latest =
        data[
            data.length - 1
        ];

    const aqi =
        getAQIValue(
            latest
        );

    const color =
        getTrendAQIColor(
            aqi
        );

    const category =
        getTrendAQICategory(
            aqi
        );

    const valueElement =
        document.getElementById(
            "trendCurrentAQI"
        );

    const categoryElement =
        document.getElementById(
            "trendCurrentCategory"
        );

    if (valueElement) {

        valueElement.textContent =
            Math.round(aqi);

        valueElement.style.setProperty(
            "color",
            color,
            "important"
        );
    }

    if (categoryElement) {

        categoryElement.textContent =
            category;

        categoryElement.style.setProperty(
            "color",
            color,
            "important"
        );
    }
}


/* =========================================================
   7 DAY AVERAGE
   ========================================================= */

function updateAverageAQI(data) {

    const latest =
        new Date(
            data[
                data.length - 1
            ].timestamp
        );

    const cutoff =
        new Date(
            latest
        );

    cutoff.setDate(
        cutoff.getDate() - 7
    );

    const recent =
        data.filter(
            point => {

                const date =
                    new Date(
                        point.timestamp
                    );

                return date >= cutoff;
            }
        );

    const values =
        recent

        .map(
            getAQIValue
        )

        .filter(
            value =>
                value !== null
        );

    if (!values.length) {
        return;
    }

    const average =
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        values.length;

    const color =
        getTrendAQIColor(
            average
        );

    const category =
        getTrendAQICategory(
            average
        );

    const valueElement =
        document.getElementById(
            "trendAverageAQI"
        );

    const categoryElement =
        document.getElementById(
            "trendAverageCategory"
        );

    if (valueElement) {

        valueElement.textContent =
            Math.round(
                average
            );

        valueElement.style.setProperty(
            "color",
            color,
            "important"
        );
    }

    if (categoryElement) {

        categoryElement.textContent =
            category;

        categoryElement.style.setProperty(
            "color",
            color,
            "important"
        );
    }
}


/* =========================================================
   GET PERIOD DATA
   ========================================================= */

function getTrendPeriodData() {

    if (
        !currentTrendData ||
        !currentTrendData.length
    ) {

        return [];
    }

    const latest =
        new Date(
            currentTrendData[
                currentTrendData.length - 1
            ].timestamp
        );

    const cutoff =
        new Date(
            latest
        );

    cutoff.setDate(
        cutoff.getDate() -
        currentTrendPeriod
    );

    return currentTrendData.filter(
        point =>
            new Date(
                point.timestamp
            ) >= cutoff
    );
}


/* =========================================================
   CREATE AQI COLOUR DATASETS
   ========================================================= */

function createAQIPointDatasets(
    labels,
    values
) {

    const categories = [

        {
            name: "Good",
            color: "#00e400"
        },

        {
            name: "Satisfactory",
            color: "#ffff00"
        },

        {
            name: "Moderate",
            color: "#ff7e00"
        },

        {
            name: "Poor",
            color: "#ff0000"
        },

        {
            name: "Very Poor",
            color: "#8f3f97"
        },

        {
            name: "Severe",
            color: "#7e0023"
        }

    ];


    return categories.map(
        function(category) {

            return {

                label:
                    category.name,

                data:
                    values.map(
                        function(value) {

                            const currentCategory =
                                getTrendAQICategory(
                                    value
                                );

                            if (
                                currentCategory ===
                                category.name
                            ) {

                                return value;

                            }

                            return null;
                        }
                    ),

                showLine:
                    false,

                pointRadius:
                    5,

                pointHoverRadius:
                    7,

                pointBackgroundColor:
                    category.color,

                pointBorderColor:
                    category.name ===
                    "Satisfactory"
                        ? "#9a9a00"
                        : category.color,

                pointBorderWidth:
                    1.5,

                borderWidth:
                    0,

                fill:
                    false

            };

        }
    );
}


/* =========================================================
   UPDATE CHART
   ========================================================= */

function updateTrendChart() {

    const canvas =
        document.getElementById(
            "aqiTrendChart"
        );

    if (!canvas) {
        return;
    }

    const data =
        getTrendPeriodData();

    if (!data.length) {
        return;
    }

    const labels =
        data.map(
            function(point) {

                const date =
                    new Date(
                        point.timestamp
                    );

                if (
                    currentTrendPeriod === 7
                ) {

                    return date.toLocaleString(
                        [],
                        {
                            day:
                                "2-digit",

                            hour:
                                "2-digit",

                            minute:
                                "2-digit"
                        }
                    );
                }

                return date.toLocaleDateString(
                    [],
                    {
                        day:
                            "2-digit",

                        month:
                            "short"
                    }
                );

            }
        );


    const values =
        data.map(
            getAQIValue
        );


    /* =====================================================
       DESTROY PREVIOUS CHART
       ===================================================== */

    if (aqiTrendChart) {

        aqiTrendChart.destroy();

        aqiTrendChart =
            null;
    }


    /* =====================================================
       CHART CANVAS
       ===================================================== */

    const ctx =
        canvas.getContext(
            "2d"
        );


    /* =====================================================
       AREA GRADIENT
       ===================================================== */

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            220
        );

    gradient.addColorStop(
        0,
        "rgba(26,115,232,0.20)"
    );

    gradient.addColorStop(
        1,
        "rgba(26,115,232,0.02)"
    );


    /* =====================================================
       AQI POINT DATASETS
       ===================================================== */

    const aqiPointDatasets =
        createAQIPointDatasets(
            labels,
            values
        );


    /* =====================================================
       MAIN LINE
       ===================================================== */

    const lineDataset = {

        label:
            "AQI Trend",

        data:
            values,

        borderColor:
            "#ff7e00",

        backgroundColor:
            gradient,

        borderWidth:
            2.5,

        fill:
            true,

        tension:
            0.35,

        pointRadius:
            0,

        pointHoverRadius:
            0,

        spanGaps:
            true,

        order:
            1

    };


    /* =====================================================
       CREATE CHART
       ===================================================== */

    aqiTrendChart =
        new Chart(
            ctx,
            {

                type:
                    "line",

                data: {

                    labels:
                        labels,

                    datasets: [

                        lineDataset,

                        ...aqiPointDatasets

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    animation:
                        false,

                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },

                    plugins: {

                        legend: {

                            display:
                                false

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function(context) {

                                        if (
                                            context.datasetIndex !== 0
                                        ) {

                                            const value =
                                                Number(
                                                    context.raw
                                                );

                                            if (
                                                !Number.isFinite(
                                                    value
                                                )
                                            ) {

                                                return "";

                                            }

                                            return (
                                                "AQI: " +
                                                Math.round(
                                                    value
                                                ) +
                                                " — " +
                                                getTrendAQICategory(
                                                    value
                                                )
                                            );
                                        }

                                        return null;
                                    }

                            }

                        }

                    },

                    scales: {

                        x: {

                            grid: {

                                display:
                                    false

                            },

                            ticks: {

                                maxTicksLimit:
                                    currentTrendPeriod === 7
                                        ? 7
                                        : 8,

                                color:
                                    "#7a8699",

                                font: {

                                    size:
                                        10

                                }

                            }

                        },

                        y: {

                            beginAtZero:
                                true,

                            suggestedMax:
                                300,

                            grid: {

                                color:
                                    "rgba(148,163,184,0.16)"

                            },

                            ticks: {

                                color:
                                    "#7a8699",

                                font: {

                                    size:
                                        10

                                }

                            }

                        }

                    }

                }

            }
        );


    /* =====================================================
       COLOUR THE LINE USING AQI LEVEL
       ===================================================== */

    if (
        aqiTrendChart &&
        aqiTrendChart.data &&
        aqiTrendChart.data.datasets &&
        aqiTrendChart.data.datasets[0]
    ) {

        /*
         * Use the AQI category of the current station's
         * average value for the main trend line.
         */

        const average =
            values.reduce(
                function(sum, value) {

                    return sum +
                        Number(value || 0);

                },
                0
            ) /
            values.length;

        const lineColor =
            getTrendAQIColor(
                average
            );

        aqiTrendChart.data.datasets[0]
            .borderColor =
            lineColor;

        aqiTrendChart.update(
            "none"
        );
    }


    /* =====================================================
       PERIOD TEXT
       ===================================================== */

    const periodText =
        document.getElementById(
            "trendChartPeriodText"
        );

    if (periodText) {

        periodText.textContent =
            currentTrendPeriod === 7
                ? "Last 7 days"
                : "Last 30 days";
    }
}


/* =========================================================
   BEST / WORST PERIOD
   ========================================================= */

function updateBestWorst(data) {

    if (!data.length) {
        return;
    }

    const grouped = {};


    data.forEach(
        function(point) {

            const date =
                new Date(
                    point.timestamp
                );

            const key =
                date.toLocaleDateString(
                    [],
                    {
                        day:
                            "2-digit",

                        month:
                            "short"
                    }
                );

            if (!grouped[key]) {

                grouped[key] =
                    [];
            }

            const value =
                getAQIValue(
                    point
                );

            if (value !== null) {

                grouped[key].push(
                    value
                );
            }

        }
    );


    const daily =
        Object.entries(
            grouped
        )
        .map(
            function(
                [date, values]
            ) {

                const average =
                    values.reduce(
                        (a, b) =>
                            a + b,
                        0
                    ) /
                    values.length;

                return {

                    date:
                        date,

                    average:
                        average

                };

            }
        );


    if (!daily.length) {
        return;
    }


    const best =
        [...daily].sort(
            (a, b) =>
                a.average -
                b.average
        )[0];


    const worst =
        [...daily].sort(
            (a, b) =>
                b.average -
                a.average
        )[0];


    const bestElement =
        document.getElementById(
            "trendBestPeriod"
        );

    const worstElement =
        document.getElementById(
            "trendWorstPeriod"
        );


    if (bestElement) {

        bestElement.textContent =
            best.date +
            " · AQI " +
            Math.round(
                best.average
            );

        bestElement.style.setProperty(
            "color",
            getTrendAQIColor(
                best.average
            ),
            "important"
        );
    }


    if (worstElement) {

        worstElement.textContent =
            worst.date +
            " · AQI " +
            Math.round(
                worst.average
            );

        worstElement.style.setProperty(
            "color",
            getTrendAQIColor(
                worst.average
            ),
            "important"
        );
    }
}


/* =========================================================
   TREND INSIGHT
   ========================================================= */

function updateTrendInsight(data) {

    if (!data.length) {
        return;
    }

    const values =
        data

        .map(
            getAQIValue
        )

        .filter(
            value =>
                value !== null
        );

    if (!values.length) {
        return;
    }

    const average =
        values.reduce(
            (a, b) =>
                a + b,
            0
        ) /
        values.length;

    const color =
        getTrendAQIColor(
            average
        );

    const category =
        getTrendAQICategory(
            average
        );

    const insight =
        document.getElementById(
            "trendInsightText"
        );

    if (!insight) {
        return;
    }


    if (average <= 50) {

        insight.textContent =
            "Air quality has remained mostly good during this period, with an average AQI of " +
            Math.round(average) +
            ".";

    }
    else if (average <= 100) {

        insight.textContent =
            "Air quality has generally remained satisfactory, with an average AQI of " +
            Math.round(average) +
            ".";

    }
    else if (average <= 200) {

        insight.textContent =
            "Air quality has been moderate during this period. The average AQI is " +
            Math.round(average) +
            ".";

    }
    else if (average <= 300) {

        insight.textContent =
            "Air quality has been poor during this period. The average AQI is " +
            Math.round(average) +
            ".";

    }
    else if (average <= 400) {

        insight.textContent =
            "Air quality has been very poor during this period. The average AQI is " +
            Math.round(average) +
            ".";

    }
    else {

        insight.textContent =
            "Air quality has reached severe levels during this period. The average AQI is " +
            Math.round(average) +
            ".";
    }


    insight.style.setProperty(
        "border-left",
        "4px solid " + color,
        "important"
    );
}


/* =========================================================
   PERIOD BUTTONS
   ========================================================= */

function setTrendPeriod(period) {

    period =
        Number(period);

    if (
        period !== 7 &&
        period !== 30
    ) {

        period = 7;
    }

    currentTrendPeriod =
        period;


    document
        .querySelectorAll(
            ".trend-period-btn"
        )
        .forEach(
            function(button) {

                const buttonPeriod =
                    Number(
                        button.dataset.period
                    );

                button.classList.toggle(
                    "active",
                    buttonPeriod ===
                    period
                );

            }
        );


    updateTrendChart();
}


/* =========================================================
   DOM EVENTS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const stationSelect =
            document.getElementById(
                "trendStation"
            );


        if (stationSelect) {

            stationSelect.addEventListener(
                "change",
                function() {

                    if (this.value) {

                        loadTrendStation(
                            this.value
                        );
                    }

                }
            );
        }


        document
            .querySelectorAll(
                ".trend-period-btn"
            )
            .forEach(
                function(button) {

                    button.addEventListener(
                        "click",
                        function() {

                            setTrendPeriod(
                                this.dataset.period
                            );

                        }
                    );

                }
            );

    }
);


/* =========================================================
   CLEAR DASHBOARD
   ========================================================= */

function clearTrendDashboard() {

    const valueIds = [

        "trendCurrentAQI",
        "trendAverageAQI"

    ];


    const textIds = [

        "trendCurrentCategory",
        "trendAverageCategory",
        "trendBestPeriod",
        "trendWorstPeriod"

    ];


    valueIds.forEach(
        function(id) {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.textContent =
                    "--";

                element.style.color =
                    "";

            }

        }
    );


    textIds.forEach(
        function(id) {

            const element =
                document.getElementById(
                    id
                );

            if (element) {

                element.textContent =
                    "--";

                element.style.color =
                    "";

            }

        }
    );


    const insight =
        document.getElementById(
            "trendInsightText"
        );

    if (insight) {

        insight.textContent =
            "No AQI history is available for this station.";

        insight.style.borderLeft =
            "";
    }


    if (aqiTrendChart) {

        aqiTrendChart.destroy();

        aqiTrendChart =
            null;
    }
}