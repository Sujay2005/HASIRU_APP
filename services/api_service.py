import requests
import pandas as pd
from datetime import datetime

from config import SERVER_URL


def get_latest_points():

    response = requests.get(
        f"{SERVER_URL}/latest_points",
        timeout=10
    )

    response.raise_for_status()

    return response.json()


def get_latest_dataframe():

    response = requests.get(
        f"{SERVER_URL}/latest_dataframe",
        timeout=10
    )

    response.raise_for_status()

    df = pd.DataFrame(response.json())

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        format="mixed",
        utc=True
    )

    return df

def get_all_history():

    response = requests.get(
        f"{SERVER_URL}/all_history",
        timeout=10
    )

    response.raise_for_status()

    df = pd.DataFrame(response.json())

    df["timestamp"] = pd.to_datetime(
        df["timestamp"],
        format="mixed",
        utc=True
    )

    return df

def get_history(date, hour):

    response = requests.get(
        f"{SERVER_URL}/history/{date}/{hour}",
        timeout=10
    )

    response.raise_for_status()

    return response.json()


def get_current_points():

    from services.prediction import get_predicted_points

    latest_points = get_latest_points()

    if len(latest_points) == 0:
        return get_predicted_points()

    latest_df = get_latest_dataframe()

    latest_timestamp = latest_df["timestamp"].max()

    current_time = datetime.now()

    hours_difference = (
        current_time - latest_timestamp
    ).total_seconds() / 3600

    print("\n=========================")
    print("Latest Database Time :", latest_timestamp)
    print("Current Time         :", current_time)
    print("Hours Difference     :", round(hours_difference,2))
    print("=========================\n")

    if hours_difference <= 1:

        print("Using REAL AQI\n")

        return latest_points

    else:

        print("Using PREDICTED CURRENT AQI\n")

        return get_predicted_points()