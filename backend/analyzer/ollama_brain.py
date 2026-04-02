import os
import json
import time
import requests
import psycopg2


OLLAMA_URL = "http://siem-local-ai:11434/api/generate"
MODEL_NAME = "qwen2.5:3b" # "phi3:mini"

def get_db_conn():
    with open('/run/secrets/db_pass', 'r') as f:
        password = f.read().strip()
    return psycopg2.connect(
        host="siem-db", database="postgres", user="postgres", password=password
    )

def analyze_alerts():
    print(f"***** Local AI Active: Using {MODEL_NAME}....", flush=True)
    while True:
        conn = None
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            
            cur.execute("SELECT id, alert_type, source_ip, details FROM detected_alerts WHERE ai_check = 'PENDING' LIMIT 1")
            alerts = cur.fetchall()

            for alert_id, alert_type, src_ip, details in alerts:
                cur.execute("SELECT proto, dst_port FROM packets WHERE src_ip = %s ORDER BY time DESC LIMIT 5", (src_ip,))
                traffic = cur.fetchall()
                traffic_str = ", ".join([f"Port:{p[1]}" for p in traffic])

                prompt = f"""
                [INST] Analyze SIEM alert. Return ONLY JSON. Don't panic and make sure about the severity.
                Type: {alert_type} | Source: {src_ip} | Details: {details} | Traffic: {traffic_str}
                JSON keys: "label" (bool), "severity" (LOW/MEDIUM/HIGH/CRITICAL), "summary", "employee_notice" [/INST]
                """

                payload = {
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.1, 
                        "num_predict": 300   
                    }
                }

                try:
                    response = requests.post(OLLAMA_URL, json=payload, timeout=120)
                    response.raise_for_status()
                    
                    raw_ai_out = response.json().get('response', '{}')
                    analysis = json.loads(raw_ai_out)

                    cur.execute("""
                        UPDATE detected_alerts 
                        SET ai_label = %s, severity = %s, ai_analysis = %s, ai_check = 'done'
                        WHERE id = %s
                    """, (
                        str(analysis.get('label', False)), 
                        analysis.get('severity', 'MEDIUM'), 
                        json.dumps({
                            "summary": analysis.get('summary', 'Analysis timeout'),
                            "employee_notice": analysis.get('employee_notice', 'Checking security...')
                        }), 
                        alert_id
                    ))
                    conn.commit()
                    print(f"*****  Analyzed {alert_id} successfully.", flush=True)

                except Exception as ai_err:
                    print(f"!!!!!! Ollama Error on ID {alert_id}: {ai_err}", flush=True)
                    cur.execute("UPDATE detected_alerts SET ai_check = 'FAILED' WHERE id = %s", (alert_id,))
                    conn.commit()

            cur.close()
        except Exception as e:
            print(f"!!!!!! System Error: {e}", flush=True)
        finally:
            if conn:
                conn.close()
        
        time.sleep(5)

if __name__ == "__main__":
    analyze_alerts()