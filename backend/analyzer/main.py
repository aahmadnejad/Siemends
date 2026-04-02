import psycopg2, time, pika, json


WHITELIST = [
   # "172.18.0.200",  # rabbitmq
]


def get_db_conn():
    with open('/run/secrets/db_pass', 'r') as f:
        password = f.read().strip()
    return psycopg2.connect(host="siem-db", database="postgres", user="postgres", password=password)

def trigger_alert(alert_type, source, victim, details):
    print(f'----- {source} \n\n', flush=True)
    if source in WHITELIST:
        return
    connection = pika.BlockingConnection(pika.ConnectionParameters(host='rabbitmq'))
    channel = connection.channel()
    channel.queue_declare(queue='alerts_queue', durable=True)
    
    payload = {"type": alert_type, "source": source, "victim": victim, "details": details}
    channel.basic_publish(exchange='', routing_key='alerts_queue', body=json.dumps(payload))
    connection.close()
    print(f"***** Alert Triggered: {alert_type} from {source}")

def run_checks():
    conn = get_db_conn()
    cur = conn.cursor()
    
    # ARP Spoofing
    cur.execute("""
        SELECT src_ip, COUNT(DISTINCT src_mac) as mac_count 
        FROM packets 
        WHERE time > NOW() - INTERVAL '5 minutes'
        GROUP BY src_ip HAVING COUNT(DISTINCT src_mac) > 1;
    """)
    for row in cur.fetchall():
        trigger_alert("ARP_SPOOF", row[0], "Network", f"IP associated with {row[1]} different MAC addresses.")

    # Port Scan
    cur.execute("""
        SELECT src_ip, dst_ip, COUNT(DISTINCT dst_port) as port_count
        FROM packets
        WHERE time > NOW() - INTERVAL '30 seconds'
        GROUP BY src_ip, dst_ip 
        HAVING COUNT(DISTINCT dst_port) > 5; 
    """)
    for row in cur.fetchall():
        trigger_alert("PORT_SCAN", row[0], row[1], f"Vertical scan detected: {row[2]} unique ports hit.")

    # SYN Flood / DOS
    cur.execute("""
        SELECT src_ip, dst_ip, COUNT(*) as packet_count
        FROM packets
        WHERE time > NOW() - INTERVAL '10 seconds'
        GROUP BY src_ip, dst_ip 
        HAVING COUNT(*) > 50;
    """)
    for row in cur.fetchall():
        trigger_alert("DOS_ATTEMPT", row[0], row[1], f"High volume traffic: {row[2]} packets in 10s.")

    cur.close()
    conn.close()

while True:
    run_checks()
    time.sleep(10)