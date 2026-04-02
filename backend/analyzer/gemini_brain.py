import os
import json
import time
import psycopg2
from google import genai
from google.genai import types
import random

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_db_conn():
    with open('/run/secrets/db_pass', 'r') as f:
        password = f.read().strip()
    return psycopg2.connect(
        host="siem-db", 
        database="postgres", 
        user="postgres", 
        password=password
    )

def analyze_alerts():
    print("***** Gemini actived....", flush=True)
    while True:
        try:
            conn = get_db_conn()
            cur = conn.cursor()
            
            cur.execute("SELECT id, alert_type, source_ip, details FROM detected_alerts WHERE ai_label = 'PENDING' LIMIT 5")
            alerts = cur.fetchall()

            for alert_id, alert_type, src_ip, details in alerts:
                cur.execute("SELECT proto, dst_port, size FROM packets WHERE src_ip = %s ORDER BY time DESC LIMIT 5", (src_ip,))
                recent_traffic = cur.fetchall()
                traffic_summary = ", ".join([f"Port:{p[1]} (Size:{p[2]})" for p in recent_traffic])

                prompt = f"""
                SIEM INCIDENT ANALYSIS:
                Alert Type: {alert_type}
                Target Details: {details}
                Source IP: {src_ip}
                Recent Traffic Pattern: {traffic_summary}

                TASK:
                Compare the alert to the recent traffic. 
                Is this a single event or part of a larger scan?
                Identify if the victim is a critical asset (like the DB at .2).

                Respond ONLY in JSON:
                {{
                    "label": "True Positive/False Positive",
                    "severity": "LOW/MEDIUM/HIGH/CRITICAL",
                    "summary": "Explain based on the traffic pattern seen.",
                    "employee_notice": "Short warning for non-technical staff."
                }}
                """
                response = client.models.generate_content(
                    model='gemini-1.5-flash-002', 
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                    contents=prompt
                )
                
            
                analysis = json.loads(response.text)
                clean_metadata = {
                    "summary": analysis['summary'],
                    "employee_notice": analysis['employee_notice']
                }
        

                cur.execute("""
                    UPDATE detected_alerts 
                    SET ai_label = %s, severity = %s, ai_analysis = %s 
                    WHERE id = %s
                """, (analysis['label'], analysis['severity'], json.dumps(clean_metadata), alert_id))
                
                print(f"- Analyzed {alert_type} from {src_ip}: {analysis['severity']} -- {analysis['summary']}\n\n", flush=True)

            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            print(f"!!!!!! Analysis Error: {e}", flush=True)
            if "429" in str(e):
                wait_time = random.randint(30, 60)
                print(f":))))  Rate limit hit. Sleeping for {wait_time}s...", flush=True)
                time.sleep(wait_time)
                continue 

if __name__ == "__main__":
    analyze_alerts()