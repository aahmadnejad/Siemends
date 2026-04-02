import pika
import json
import psycopg2
import psycopg2.extras 
import argparse
import time
from datetime import datetime

parser = argparse.ArgumentParser(description="my SIEM Ingestor")
parser.add_argument('--mode', choices=['packets', 'alerts'], required=True)
args = parser.parse_args()

BATCH_SIZE = 400  
packet_buffer = []

def get_db_conn():
    try:
        with open('/run/secrets/db_pass', 'r') as f:
            password = f.read().strip()
        return psycopg2.connect(
            host="siem-db", database="postgres", user="postgres", 
            password=password, connect_timeout=10
        )
    except Exception as e:
        print(f"!!!! DB Connection Error: {e}", flush=True)
        return None

db_conn = get_db_conn()

def flush_packet_buffer(ch, method):
    global packet_buffer, db_conn
    if not packet_buffer:
        return

    try:
        if db_conn is None or db_conn.closed != 0:
            db_conn = get_db_conn()

        cur = db_conn.cursor()
        query = """
            INSERT INTO packets (time, sensor_id, src_mac, dst_mac, src_ip, dst_ip, src_port, dst_port, proto, flags, size, raw_hex)
            VALUES %s
        """
        psycopg2.extras.execute_values(cur, query, packet_buffer)
        
        db_conn.commit()
        cur.close()

        ch.basic_ack(delivery_tag=method.delivery_tag, multiple=True)
        print(f"***** Batched {len(packet_buffer)} packets to DB.", flush=True)
        packet_buffer = [] 
        
    except Exception as e:
        print(f"!!!!!!!!!! Batch Write Error: {e}", flush=True)
        db_conn.rollback()

def callback(ch, method, properties, body):
    global db_conn, packet_buffer
    data = json.loads(body)

    try:
        if args.mode == 'packets':
            packet_buffer.append((
                datetime.now(),
                data.get('sensor_id'), data.get('src_mac'), data.get('dst_mac'),
                data.get('src_ip'), data.get('dst_ip'), data.get('src_port'),
                data.get('dst_port'), data.get('proto'), data.get('flags'),
                data.get('size'), data.get('raw_hex')
            ))

            if len(packet_buffer) >= BATCH_SIZE:
                flush_packet_buffer(ch, method)

        elif args.mode == 'alerts':
            if db_conn is None or db_conn.closed != 0:
                db_conn = get_db_conn()
            
            cur = db_conn.cursor()
            cur.execute("""
                INSERT INTO detected_alerts (alert_type, source_ip, victim_ip, details, ai_check)
                VALUES (%s, %s, %s, %s, 'PENDING')
            """, (data.get('type'), data.get('source'), data.get('victim'), data.get('details')))
            
            db_conn.commit()
            cur.close()
            ch.basic_ack(delivery_tag=method.delivery_tag)
            print(f"******* ALERT SAVED : {data.get('type')}", flush=True)

    except Exception as e:
        print(f"!!!!!!!!!!!!! Error in {args.mode} worker: {e}", flush=True)
        ch.basic_ack(delivery_tag=method.delivery_tag)

def start_worker():
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(host='rabbitmq', heartbeat=600)
            )
            channel = connection.channel()
            
            queue_name = 'packet_logs' if args.mode == 'packets' else 'alerts_queue'
            channel.queue_declare(queue=queue_name, durable=True)

            prefetch = BATCH_SIZE * 2 if args.mode == 'packets' else 1
            channel.basic_qos(prefetch_count=prefetch)
            
            channel.basic_consume(queue=queue_name, on_message_callback=callback)
            print(f"***** {args.mode.upper()} worker live (Batching: {args.mode == 'packets'})", flush=True)
            channel.start_consuming()
        except Exception as e:
            print(f"!!!!!!!!!!!Connection lost. Retrying... ({e})", flush=True)
            time.sleep(5)

if __name__ == "__main__":
    start_worker()