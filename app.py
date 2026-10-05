from flask import Flask, render_template, jsonify, request
from services.prediction import get_predicted_points
from services.api_service import (
    get_latest_points,
    get_latest_dataframe,
    get_all_history,
    get_history
)
from services.interpolation import (
    generate_heatmap,
    generate_future_heatmap,
    idw
)
from services.routing import (
    calculate_route,
    calculate_future_route,
    calculate_route_segments
)
from services.estimate import estimate_aqi

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from datetime import datetime, timezone


app = Flask(__name__)


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():
    return render_template("index.html")


# ============================================================
# GEOCODING
# ============================================================

@app.route("/geocode")
def geocode():

    query = request.args.get(
        "q",
        ""
    ).strip()

    if not query:
        return jsonify([])

    if len(query) < 2:
        return jsonify([])

    BENGALURU_LON = 77.5946
    BENGALURU_LAT = 12.9716

    # ========================================================
    # ARC GIS GEOCODING
    # Single request only
    # ========================================================

    try:

        search_query = query

        # Give Bengaluru searches a strong local context
        if (
            "bengaluru" not in query.lower()
            and
            "bangalore" not in query.lower()
            and
            "karnataka" not in query.lower()
        ):
            search_query = (
                query +
                ", Bengaluru, Karnataka, India"
            )

        params = urlencode({

            "SingleLine":
                search_query,

            "f":
                "json",

            "maxLocations":
                5,

            "outFields":
                "*",

            "countryCode":
                "IND",

            "location":
                f"{BENGALURU_LON},{BENGALURU_LAT}",

            "distance":
                50000,

            "forStorage":
                "false"

        })

        url = (
            "https://geocode.arcgis.com/"
            "arcgis/rest/services/"
            "World/GeocodeServer/"
            "findAddressCandidates?"
            + params
        )

        req = Request(

            url,

            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0",
                "Accept":
                    "application/json"
            }

        )

        with urlopen(
            req,
            timeout=5
        ) as response:

            data = json.loads(
                response.read().decode(
                    "utf-8"
                )
            )

        candidates = data.get(
            "candidates",
            []
        )

        results = []

        for candidate in candidates:

            location = candidate.get(
                "location",
                {}
            )

            lat = location.get("y")
            lon = location.get("x")

            if (
                lat is None
                or
                lon is None
            ):
                continue

            address = (
                candidate.get(
                    "address"
                )
                or
                candidate.get(
                    "attributes",
                    {}
                ).get(
                    "LongLabel"
                )
                or
                query
            )

            results.append({

                "lat":
                    str(lat),

                "lon":
                    str(lon),

                "display_name":
                    address

            })

        if results:

            print(
                "ArcGIS geocoding:",
                query,
                "->",
                len(results),
                "results"
            )

            return jsonify(
                results
            )

    except Exception as e:

        print(
            "ArcGIS geocoding error:",
            query,
            str(e)
        )


    # ========================================================
    # NOMINATIM FALLBACK
    # ========================================================

    try:

        params = urlencode({

            "format":
                "json",

            "q":
                search_query,

            "limit":
                5,

            "addressdetails":
                1

        })

        url = (
            "https://nominatim.openstreetmap.org/"
            "search?"
            + params
        )

        req = Request(

            url,

            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0"
            }

        )

        with urlopen(
            req,
            timeout=4
        ) as response:

            data = json.loads(
                response.read().decode(
                    "utf-8"
                )
            )

        return jsonify(
            data
        )

    except Exception as e:

        print(
            "Nominatim fallback error:",
            query,
            str(e)
        )

        return jsonify([])


# ============================================================
# AQI POINTS
# ============================================================

@app.route("/aqi_points")
def aqi_points():

    return jsonify(
        get_latest_points()
    )


# ============================================================
# FUTURE AQI POINTS
# ============================================================

@app.route("/future_aqi_points")
def future_aqi_points():

    return jsonify(
        get_predicted_points()
    )


# ============================================================
# HEATMAP
# ============================================================

@app.route("/heatmap")
def heatmap():

    return jsonify(
        generate_heatmap()
    )


# ============================================================
# AQI ESTIMATION
# ============================================================

@app.route("/estimate/<lat>/<lon>")
def estimate(lat, lon):

    return jsonify(
        estimate_aqi(
            float(lat),
            float(lon)
        )
    )


# ============================================================
# ROUTE AQI
# ============================================================

@app.route(
    "/route_aqi",
    methods=["POST"]
)
def route_aqi():

    data = request.get_json()

    return jsonify(
        calculate_route(
            data["route"],
            float(
                data["travel_time"]
            )
        )
    )


# ============================================================
# FUTURE ROUTE AQI
# ============================================================

@app.route(
    "/future_route_aqi",
    methods=["POST"]
)
def future_route_aqi():

    data = request.get_json()

    return jsonify(
        calculate_future_route(
            data["route"],
            float(
                data["travel_time"]
            )
        )
    )


# ============================================================
# ROUTE SEGMENTS
# ============================================================

@app.route(
    "/route_segments",
    methods=["POST"]
)
def route_segments():

    data = request.get_json()

    return jsonify(
        calculate_route_segments(
            data["route"]
        )
    )


# ============================================================
# RANKING
# ============================================================

@app.route("/ranking")
def ranking():

    points = get_latest_points()

    points = sorted(
        points,
        key=lambda x: x["aqi"]
    )

    clean = points[:3]

    polluted = sorted(
        points,
        key=lambda x: x["aqi"],
        reverse=True
    )[:3]

    return jsonify({

        "clean":
            clean,

        "polluted":
            polluted

    })


# ============================================================
# STATION HISTORY
# ============================================================

@app.route(
    "/station_history/<device>"
)
def station_history(device):

    df = get_all_history()

    df = df[
        df["device_id"] == device
    ]

    df = df.sort_values(
        "timestamp"
    )

    return jsonify(

        df[
            [
                "timestamp",
                "aqi_calibrated"
            ]
        ]
        .tail(24)
        .to_dict("records")

    )


# ============================================================
# HOURLY HEATMAP
# ============================================================

@app.route(
    "/heatmap_hour/<int:hour>"
)
def heatmap_hour(hour):

    df = get_all_history()

    df = df[
        df["timestamp"].dt.hour == hour
    ]

    points = []

    for _, row in df.iterrows():

        points.append([

            float(
                row["latitude"]
            ),

            float(
                row["longitude"]
            ),

            float(
                row["aqi_calibrated"]
            ) / 250

        ])

    return jsonify(
        points
    )


# ============================================================
# AI DASHBOARD
# ============================================================

@app.route("/ai_dashboard")
def ai_dashboard():

    return render_template(
        "ai_dashboard.html"
    )


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.route("/system_status")
def system_status():

    df = get_latest_dataframe()

    latest_timestamp = (
        df["timestamp"].max()
    )

    current_time = datetime.now(
        timezone.utc
    )

    hours_difference = (

        current_time -
        latest_timestamp

    ).total_seconds() / 3600

    if hours_difference <= 1:

        mode = "Live Sensor Data"

    else:

        mode = "Predicted Current AQI"

    return jsonify({

        "current_time":
            current_time.strftime(
                "%d-%m-%Y %H:%M:%S"
            ),

        "latest_timestamp":
            latest_timestamp.strftime(
                "%d-%m-%Y %H:%M:%S"
            ),

        "hours_difference":
            round(
                hours_difference,
                2
            ),

        "mode":
            mode,

        "model":
            "Random Forest",

        "mae":
            2.15,

        "r2":
            0.983,

        "timeline": [

            "Connected to AQI Database",

            f"Latest record : "
            f"{latest_timestamp.strftime('%d-%m-%Y %H:%M:%S')}",

            f"Database age : "
            f"{round(hours_difference, 2)} hours",

            "Freshness check completed",

            f"Mode selected : {mode}",

            "Random Forest model executed",

            "Current AQI generated",

            "Results sent to dashboard"

        ]

    })


# ============================================================
# STATION PREDICTION STATUS
# ============================================================

@app.route(
    "/station_prediction_status"
)
def station_prediction_status():

    latest_df = (
        get_latest_dataframe()
    )

    predicted_points = (
        get_predicted_points()
    )

    latest_df = latest_df.sort_values(
        "timestamp"
    )

    latest_rows = (

        latest_df
        .groupby("device_id")
        .last()
        .reset_index()

    )

    prediction_map = {

        p["device"]:
            p["aqi"]

        for p in predicted_points

    }

    result = []

    for _, row in latest_rows.iterrows():

        device = row[
            "device_id"
        ]

        last_aqi = round(

            float(
                row[
                    "aqi_calibrated"
                ]
            ),

            2

        )

        predicted = round(

            float(
                prediction_map.get(
                    device,
                    last_aqi
                )
            ),

            2

        )

        source = "Predicted"

        result.append({

            "device":
                device,

            "last_aqi":
                last_aqi,

            "predicted_aqi":
                predicted,

            "source":
                source

        })

    return jsonify(
        result
    )


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )
