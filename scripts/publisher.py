import time
import json
import random
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

BROKER = "localhost"
PORT = 1883
INTERVALO_SEGUNDOS = 10   

PROB_INVALIDO = 0.05      
VALOR_INVALIDO = -999 

COLUMNAS_CLIMA = {
    "humedad": {"min": 40, "max" : 90, "decimales": 1},
    "temperatura" : {"min": 15, "max": 32, "decimales": 1},
    "co2": {"min": 380, "max" : 900, "decimales": 0},
    "pm25": {"min": 5, "max" : 60, "decimales": 0},
    "gas":         {"min": 0,    "max": 5,     "decimales": 1},  
    "iluminancia": {"min": 0,    "max": 20000, "decimales": 0},  
    "pm10":        {"min": 10,   "max": 90,    "decimales": 0},  
    "presion":     {"min": 99.5, "max": 102.5, "decimales": 2},  
    "ruido":       {"min": 35,   "max": 75,    "decimales": 1}, 
}

COLUMNAS_SUELO = {
    "nitrogeno": {"min": 10, "max": 200, "decimales": 0},  
    "fosforo":   {"min": 5,  "max": 150, "decimales": 0},  
    "potasio":   {"min": 20, "max": 300, "decimales": 0},  
}

DISPOSITIVOS = [
    {"device_id": "byx-estacion-01", "type": "clima", "columnas": COLUMNAS_CLIMA},
    {"device_id": "npk-parcela-01",  "type": "suelo", "columnas": COLUMNAS_SUELO},
    {"device_id": "npk-parcela-02",  "type": "suelo", "columnas": COLUMNAS_SUELO},
]

def generar_valor(config):
    #esta es la unica funcion falsa,  cuando tengamos el hardware funcional entonces ya reemplazamos con el TTN
    if random.random() < PROB_INVALIDO:
        return VALOR_INVALIDO
    
    valor = random.uniform(config["min"], config["max"])
    if config["decimales"] == 0:
        return int(round(valor))
    return round(valor, config["decimales"])

def general_lectura(dispositivo):
    lectura = {
        "device_id" : dispositivo["device_id"],
        "type" : dispositivo["type"],
        "timestamp" : datetime.now(timezone.utc).isoformat(),
    }
    for nombre, config in dispositivo["columnas"].items():
        lectura[nombre] = generar_valor(config)
    return lectura

def topic_para(dispositivo):
    return f"sensores/{dispositivo['type']}/{dispositivo['device_id']}"

def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    try:
        client.connect(BROKER, PORT, keepalive=60)
    except ConnectionRefusedError:
        print(f"No se pudo conectar al broker MQTT en {BROKER}:{PORT}")
        return

    client.loop_start()
    print(f"Publicando datos de sensores cada {INTERVALO_SEGUNDOS} segundos...")
    try:
        while True:
            for dispositivo in DISPOSITIVOS:
                lectura = general_lectura(dispositivo)
                topic = topic_para(dispositivo)
                client.publish(topic, json.dumps(lectura))
                print(f"Publicado en {topic}: {lectura}")
            time.sleep(INTERVALO_SEGUNDOS)
    except KeyboardInterrupt:
        print("Interrupción del usuario. Saliendo...")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()





        


