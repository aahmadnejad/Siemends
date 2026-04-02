import os
import json
import pika
import binascii
from scapy.all import sniff, IP, TCP, UDP, Ether

SENSOR_ID = os.getenv('HOSTNAME', 'unknown-host')
RABBITMQ_HOST = 'rabbitmq'

def get_rabbit_channel():
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
    channel = connection.channel()
    channel.queue_declare(queue='packet_logs', durable=True)
    return connection, channel

def process_packet(packet):
    if IP in packet:
        src_mac = packet[Ether].src if Ether in packet else "00:00:00:00:00:00"
        dst_mac = packet[Ether].dst if Ether in packet else "00:00:00:00:00:00"

        # --- BASE DATA ---
        packet_data = {
            "sensor_id": SENSOR_ID,
            "src_mac": src_mac,
            "dst_mac": dst_mac,
            "src_ip": packet[IP].src,
            "dst_ip": packet[IP].dst,
            "proto": packet[IP].proto,
            "size": len(packet),
            "src_port": 0,
            "dst_port": 0,
            "flags": "",
            "raw_hex": binascii.hexlify(bytes(packet)).decode('utf-8')
        }

        if TCP in packet:
            packet_data["src_port"] = packet[TCP].sport
            packet_data["dst_port"] = packet[TCP].dport
            packet_data["flags"] = str(packet[TCP].flags)
        elif UDP in packet:
            packet_data["src_port"] = packet[UDP].sport
            packet_data["dst_port"] = packet[UDP].dport


        try:
            conn, ch = get_rabbit_channel()
            ch.basic_publish(
                exchange='',
                routing_key='packet_logs',
                body=json.dumps(packet_data),
                properties=pika.BasicProperties(
                    delivery_mode=pika.DeliveryMode.Persistent
                )
            )
            conn.close()

            print(f"[*] {SENSOR_ID}: {packet_data['src_ip']}:{packet_data['src_port']} -> "
                  f"{packet_data['dst_ip']}:{packet_data['dst_port']} [{packet_data['flags']}]")
        except Exception as e:
            print(f"[!] RabbitMQ Error: {e}")

print(f"Sniffer on {SENSOR_ID} checked!...")
sniff(iface="eth0", prn=process_packet, store=0)