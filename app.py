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

import time


app = Flask(__name__)


# ============================================================
# GEOCODING CACHE
# ============================================================

geocode_cache = {}

GEOCODE_CACHE_TIME = 3600


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

    query = request.args.get("q", "").strip()

    if not query:
        return jsonify([])

    query_key = query.lower()

    # --------------------------------------------------------
    # CACHE
    # --------------------------------------------------------

    cached = geocode_cache.get(query_key)

    if cached:

        cached_time, cached_data = cached

        if time.time() - cached_time < GEOCODE_CACHE_TIME:

            print(
                "Geocode cache hit:",
                query
            )

            return jsonify(cached_data)


    # --------------------------------------------------------
    # NOMINATIM
    # --------------------------------------------------------

    try:

        params = urlencode({
            "format": "json",
            "q": query,
            "limit": 5,
            "addressdetails": 1
        })

        url = (
            "https://nominatim.openstreetmap.org/search?"
            + params
        )

        req = Request(
            url,
            headers={
                "User-Agent":
                    "BengaluruAQINavigator/1.0 "
                    "(Bengaluru AQI Navigator)"
            }
        )

        with urlopen(
            req,
            timeout=10
        ) as response:

            data = json.loads(
                response.read().decode("utf-8")
            )


        # ----------------------------------------------------
        # SAVE TO CACHE
        # ----------------------------------------------------

        geocode_cache[query_key] = (
            time.time(),
            data
        )


        print(
            "Geocode success:",
            query,
            "->",
            len(data),
            "results"
        )


        return jsonify(data)


    except Exception as e:

        print(
            "Geocoding error:",
            query,
            str(e)
        )


        # ----------------------------------------------------
        # RETURN OLD CACHE EVEN IF EXPIRED
        # ----------------------------------------------------

        if cached:

            print(
                "Returning stale cache for:",
                query
            )

            return jsonify(
                cached[1]
            )


        return jsonify({
            "error":
                "Geocoding failed"
        }), 502


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

@app.route("/route_aqi", methods=["POST"])
def route_aqi():

    data = request.get_json()

    return jsonify(
        calculate_route(
            data["route"],
            float(data["travel_time"])
        )
    )


# ============================================================
# FUTURE ROUTE AQI
# ============================================================

@app.route("/future_route_aqi", methods=["POST"])
def future_route_aqi():

    data = request.get_json()

    return jsonify(
        calculate_future_route(
            data["route"],
            float(data["travel_time"])
        )
    )


# ============================================================
# ROUTE SEGMENTS
# ============================================================

@app.route("/route_segments", methods=["POST"])
def route_segments():

    data = request.get_json()

    return jsonify(
        calculate_route_segments(
            data["route"]
        )
    )


# ============================================================
# HISTORY
# ============================================================

@app.route("/history")
def history():

    return jsonify(
        get_all_history()
    )


# ============================================================
# STATION HISTORY
# ============================================================

@app.route("/station_history/<station>")
def station_history(station):

    return jsonify(
        get_history(station)
    )


# ============================================================
# SYSTEM STATUS
# ============================================================

@app.route("/system_status")
def system_status():

    return jsonify({
        "status": "online",
        "time": datetime.now(
            timezone.utc
        ).isoformat()
    })


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
