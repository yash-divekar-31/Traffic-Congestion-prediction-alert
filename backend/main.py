from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# serve frontend assets
app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
def home():
    return FileResponse("frontend/index.html")


TRAFFIC_DATA = {
    "hadapsar":{
        "congestion":"72%",
        "speed":"24 km/h",
        "delay":"7 min",
        "status":"HIGH"
    },
    "hinjewadi":{
        "congestion":"84%",
        "speed":"16 km/h",
        "delay":"11 min",
        "status":"SEVERE"
    },
    "fc road":{
        "congestion":"14%",
        "speed":"54 km/h",
        "delay":"1 min",
        "status":"LOW"
    }
}

@app.get("/predict/{route}")
def predict(route:str):
    key=route.lower()
    return TRAFFIC_DATA.get(
       key,
       {"error":"route not found"}
    )